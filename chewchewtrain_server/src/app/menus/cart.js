'use client';

import { Button, Form, Modal } from 'react-bootstrap';
import { useState } from 'react';
import styles from "./page.module.css";
import { useSnackbar } from 'react-simple-snackbar';

function CartItem({ data, cart }) {
  const [openSnackbar, closeSnackbar] = useSnackbar();
  const info = cart.getItemInfo(data.item_id, data.variant_id);

  async function deleteItem() {
    if (await cart.deleteItem(data.item_id, data.variant_id)) {
      openSnackbar('Removed item from cart.');
    } else {
      openSnackbar('ERROR: Failed to remove item from cart.');
    }
  }

  return (
    <>
      <div className={styles.cart_item}>
        <p className={styles.cart_item_text}>
          {info.name} - {info.variantName} ({info.price}) x{data.quantity}
          {'  '}<a href="#" className={styles.cart_item_delete} onClick={() => deleteItem()}>(X)</a>
        </p>
      </div>
    </>
  )
}

export default function Cart({ cart, handler }) {
  const [viewOrder, setViewOrder] = useState(false);
  const [viewPay, setViewPay] = useState(false);
  const [openSnackbar, closeSnackbar] = useSnackbar();

  async function completeOrder() {
    if (await handler.submit()) {
      openSnackbar('Successfully completed order.');
    } else {
      openSnackbar('ERROR: Failed to complete order.');
    }
    setViewPay(false);
    setViewOrder(false);
  }

  let i = 0;
  return (
    <>
      <div className="cartSection">
        <img id="cart" onClick={() => setViewOrder(!viewOrder)} src="/static/shoppingCart.png" alt="Shopping Cart Icon to View Order"
          height="50" />
        {
          viewOrder ?
            (
              <div id="dropdown-content">
                {
                  // List out all items in cart
                  cart.items.length === 0 ?
                    <p>No items in cart!</p>
                  :
                    cart.items.map(item => {
                      return <CartItem key={i++} data={item} cart={handler}/>;
                    }) 
                }
                <Button id="pay" onClick={() => setViewPay(true)}>Click to Pay</Button>
              </div>
            )
            :
            <></>
        }
      </div>

      <Modal data-bs-theme="dark" backdrop="static" show={viewPay} onHide={() => setViewPay(false)}>
        <Modal.Header closeButton>
          <Modal.Title style={{}}>Confirm Payment Details</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <form onSubmit={e => e.preventDefault()}>
            <p>Credit Card Number:</p>
            <input id="credit-card" type="text" />
          </form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setViewPay(false)}>Close</Button>
          <Button variant="primary" onClick={() => completeOrder()}>Pay!</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}