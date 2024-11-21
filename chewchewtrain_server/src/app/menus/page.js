'use client';
 
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { Row, Col, Container, Button } from 'react-bootstrap';
import ChewNavbar from '../navbar.js';
import Cart from './cart.js';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from "react";
import { fetchAPI } from '../util.js';
import { useSnackbar } from 'react-simple-snackbar';

// Represents a single menu item, inside of a menu category
function MenuItem({ itemid, data, cart }) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [openSnackbar, closeSnackbar] = useSnackbar();
  const [flipped, setFlipped] = useState(false);

  async function addToCart() {
    if (await cart.addItem(data.id, data.variants[variantIndex].id)) {
      openSnackbar(`Added "${data.name} - ${data.variants[variantIndex].name}" to cart.`);
    } else {
      openSnackbar('ERROR: Failed to add item to cart!');
    }
  }

  let i = 0;
  return (
    <>
      {
        !flipped ?
          <Col key={itemid} md={4} id={`item-id-${itemid}`}>
            <div className={"align-items-start text-center " + styles.entry} onClick={() => setFlipped(!flipped)}>
              <h2>{data.name}</h2>
              <h4 className={styles.entry_desc}>{data.desc}</h4>
            </div>
          </Col>
        :
          <Col key={itemid} md={4} id={`item-id-${itemid}`}>
            <div className={"align-items-start text-center " + styles.entry_flipped}>
              {
                // List all of the variants of this item (and allow switching)
                data.variants.map(variant => {
                  let currIndex = i++;
                  return (
                    <a href={`#item-id-${itemid}`} onClick={() => setVariantIndex(currIndex)}>
                      <h3 key={currIndex} 
                          className={currIndex === variantIndex ? 
                                      styles.variant_main : styles.variant_secondary}>
                        {variant.name} - {variant.price_usd}
                      </h3>
                    </a>
                  );
                })
              }
              <Button className={styles.entry_button} variant="primary" onClick={() => addToCart()}>Add to Cart</Button>
              <Button className={styles.entry_button} variant="secondary" onClick={() => setFlipped(!flipped)}>Close</Button>
              <h6 className={styles.entry_desc_flipped}>{data.desc}</h6>
            </div>
          </Col>
      }
    </>
  );
}

// Represents a single category of item in a restaurant
function MenuCategory({ catid, data, cart }) {
  let entries = [];
  for (const entry of data.items) {
    if (entry.active !== undefined && !entry.active)
      continue;
    entries.push(<MenuItem itemid={entry.id} data={entry} cart={cart}/>)
  }

  return (
    <div key={catid}>
      <h3 className={styles.category_title}>{data.name}</h3>
      <Row className={styles.entry_list}>
        {entries}
      </Row>
    </div>
  );
}

// Helper class to manage cart operations
class CartHandler {
  constructor(cart, setCart, restaurantData) {
    this.cart = cart;
    this.setCart = setCart;
    this.restaurantData = restaurantData;
  }

  async addItem(itemId, variantId) {
    if (this.cart === undefined) {
      return false;
    }

    // Actually add this item to the cart
    const items = this.cart.items.map(i => ({...i}));
    let foundExisting = false;
    for (const item of items) {
      if (item.item_id === itemId && item.variant_id === variantId) {
        foundExisting = true;
        item.quantity++;
        break;
      }
    }
    if (!foundExisting) {
      items.push({
        item_id: itemId,
        variant_id: variantId,
        quantity: 1
      });
    }
    const data = await fetchAPI('/cart', 'PUT', JSON.stringify({
      cart_id: this.cart.id,
      items: JSON.stringify(items)
    }));
    
    // If successful, update cart state locally
    const success = (data !== undefined && data.success);
    if (success) {
      this.setCart({
        id: this.cart.id,
        items
      });
    }
    return success;
  }

  async deleteItem(itemId, variantId) {
    if (this.cart === undefined) {
      return false;
    }

    // Remove item from cart
    const items = this.cart.items.map(i => ({...i}));
    let foundExisting = -1;
    let index = 0;
    for (const item of items) {
      if (item.item_id === itemId && item.variant_id === variantId) {
        foundExisting = index;
        break;
      }
      index++;
    }
    if (foundExisting === -1) {
      return false;
    }
    items.splice(foundExisting, 1);
    const data = await fetchAPI('/cart', 'PUT', JSON.stringify({
      cart_id: this.cart.id,
      items: JSON.stringify(items)
    }));
    
    // If successful, update cart state locally
    const success = (data !== undefined && data.success);
    if (success) {
      this.setCart({
        id: this.cart.id,
        items
      });
    }
    return success;
  }

  // Searches for item info from underlying restaurant
  getItemInfo(itemId, variantId) {
    if (this.restaurantData === undefined) {
      return undefined;
    }

    // This search could instead be a map lookup, but there's no need right now
    for (const category of this.restaurantData.categories) {
      for (const item of category.items) {
        if (item.id === itemId) {
          for (const variant of item.variants) {
            if (variant.id === variantId) {
              return {
                name: item.name,
                variantName: variant.name,
                price: variant.price_usd
              };
            }
          }
        }
      }
    }

    return undefined;
  }

  // Submits cart as an order
  async submit() {
    // State checks
    if (this.cart === undefined) {
      return false;
    }
    if (this.restaurantData === undefined) {
      return false;
    }

    // Complete order
    const data = await fetchAPI('/order', 'POST', JSON.stringify({
      cart_id: this.cart.id
    }));
    if (data === undefined || !data.success) {
      return false;
    }
    console.log('Successfully completed order');
    
    // Need to make a new cart, now
    const newCartData = await fetchAPI('/cart', 'POST', JSON.stringify({ 
      restaurant: this.restaurantData.id, 
      items: '[]' 
    }));
    if (newCartData === undefined || !newCartData.success) {
      alert('Order completed, but failed to create new cart.');
      return;
    }
    this.setCart({
      id: newCartData.id,
      items: []
    })
    console.log('Successfully made new cart');

    return true;
  }
}

function ActualPage() {
  const [data, setData] = useState(undefined);
  const [cart, setCart] = useState(undefined);
  const [userStatus, setUserStatus] = useState(undefined);
  const [loaded, setLoaded] = useState(false);

  const searchParams = useSearchParams();
  const restaurantId = searchParams.get('id');
  if (restaurantId.includes('.'))
    return notFound();
  if (restaurantId.includes('/'))
    return notFound();

  const cartHandler = new CartHandler(cart, setCart, data);
  
  useEffect(async () => {
    const data = await fetchAPI(`/restaurant/${restaurantId}`);
    if (data === undefined)
      return;
    setData(data);
    if (!data.success) {
      setLoaded(true);
      return;
    }

    const cartData = await fetchAPI('/cart?restaurant=' + restaurantId, 'GET');
    if (cartData !== undefined) {
      if (cartData.success) {
        setCart({
          id: cartData.id,
          items: cartData.items
        });
        setData(data);
        console.log('Successfully loaded existing cart');
      } else {
        const newCartData = await fetchAPI('/cart', 'POST', JSON.stringify({ restaurant: restaurantId, items: '[]' }));
        if (newCartData === undefined || !newCartData.success) {
          alert('Failed to create cart.');
          return;
        }
        setCart({
          id: newCartData.id,
          items: []
        })
        setData(data);
        console.log('Successfully made new cart');
      }
    } else {
      alert('Failed to load cart.');
    }

    const userStatus = await fetchAPI(`/session/restaurant?id=${restaurantId}`);
    if (userStatus === undefined || !userStatus.success) {
      alert('Failed to load user status.');
      return;
    }
    setUserStatus(userStatus.status);

    setLoaded(true);
  }, []);

  if (!loaded)
    return <Container><Row><p style={{ marginTop: '64px' }}>Loading...</p></Row></Container>;
  if (!data.success)
    return notFound();

  let categories = [];
  let i = 0;
  for (const category of data.categories) {
    if (category.active !== undefined && !category.active)
      continue;
    if (category.items.length === 0)
      continue;
    if (category.active !== undefined && category.active) {
      // Extra check for if there's no *active* items in category
      let anyActive = false;
      for (const item of category.items) {
        if (item.active) {
          anyActive = true;
          break;
        }
      }
      if (!anyActive) {
        continue;
      }
    }
    categories.push(<MenuCategory catid={i++} data={category} cart={cartHandler}/>);
  }

  return (
    <>
      <h1 className={styles.title}>
        <span className="centerTitle">Order from {data.name}</span>
        <Cart cart={cart} handler={cartHandler}/>
      </h1>
      {categories}
      <br/>
      {
        userStatus !== 'user' ?
          <div className={styles.admin}>
            <a href={`/menus/edit/?id=${restaurantId}`} className={styles.text_edit_footer}>(Edit page)</a>
          </div>
        :
          <></>
      }
    </>
  );
}

export default function Page() {
  return (
    <main className="content p-3 mx-auto">
      <ChewNavbar/>
      <Suspense>
        <ActualPage/>
      </Suspense>
    </main>
  )
}
