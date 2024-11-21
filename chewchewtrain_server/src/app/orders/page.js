'use client';

import styles from "./page.module.css";
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import ChewNavbar from '../navbar.js';
import { Suspense, useState, useEffect } from "react";
import { unixTimestampToString, fetchAPI } from "../util.js";
import { useSnackbar } from "react-simple-snackbar";
import { useSearchParams } from "next/navigation";

function Order({ data, isUserOwned, userId, loadContent, interactable }) {
  const [openSnackbar, closeSnackbar] = useSnackbar();

  let status = 'Ongoing';
  if (data.completed) {
    status = 'Completed';
  }
  if (data.canceled) {
    status = 'Canceled';
  }

  const orderDetails = (
    <ul>
      {
        data.items.map(item => {
          return <li key={item.id}>{item.name} - {item.variant_name} (x{item.quantity})</li>;
        })
      }
    </ul>
  );

  if (isUserOwned) {
    async function cancel() {
      const cancelData = await fetchAPI(`/order/${data.id}`, 'DELETE');
      if (cancelData === undefined || !cancelData.success) {
        openSnackbar('ERROR: Failed to cancel order.');
        return;
      }
      openSnackbar('Canceled order.');
      await loadContent();
    }

    return (
      <div className={styles.order}>
        <h4>{data.restaurant.name}, at {data.time_ordered}</h4>
        <p><strong>Status:</strong> {status}{data.completed ? ` at ${data.time_completed}` : ''}</p>
        {
          (interactable && !data.completed && !data.canceled) ?
            <p>{data.workers.length === 0 ? 'Waiting for available workers...' : 'Workers assigned to order!'}</p>
          :
            <></>
        }
        <p className={styles.order_pre_sublist}><strong>Items:</strong></p>
        {orderDetails}
        {
          (interactable && !data.completed && !data.canceled) ?
            <Button variant="secondary" onClick={() => cancel()} className={styles.order_button}>Cancel</Button>
          :
            <></>
        }
      </div>
    );
  }

  let assignedToOrder = false;
  for (const worker of data.workers) {
    if (worker.id === userId) {
      assignedToOrder = true;
      break;
    }
  }
  
  async function toggleSelf() {
    const toggleData = await fetchAPI(`/order/${data.id}`, 'PUT', JSON.stringify({
      remove: assignedToOrder ? 'true' : 'false'
    }));
    if (toggleData === undefined || !toggleData.success) {
      openSnackbar('ERROR: Failed to change worker status on order.');
      return;
    }
    openSnackbar(assignedToOrder ? 'Removed self from order.' : 'Added self to order.');
    await loadContent();
  }

  async function complete() {
    const completeData = await fetchAPI(`/order/${data.id}`, 'DELETE');
    if (completeData === undefined || !completeData.success) {
      openSnackbar('ERROR: Failed to complete order.');
      return;
    }
    openSnackbar('Completed order.');
    await loadContent();
  }

  return (
    <div className={styles.order}>
      {
        data.completed ?
          <>
            <h4>Completed at {data.time_completed}</h4>
            <p>Originally ordered at {data.time_ordered}</p>
          </>
        :
          <>
            <h4>Ordered at {data.time_ordered}</h4>
          </>
      }
      <p><strong>Status:</strong> {status}</p>
      <p className={styles.order_pre_sublist}><strong>Items:</strong></p>
      {orderDetails}
      {
        data.workers.length === 0 ?
          <p>No workers assigned.</p>
        :
          <>
            <p className={styles.order_pre_sublist}>Workers assigned:</p>
            <ul>
              {
                data.workers.map(worker => {
                  return <li key={worker.id}>{worker.name} ({worker.email})</li>;
                })
              }
            </ul>
          </>
      }
      {
        interactable ?
          <>
            <Button variant="secondary" onClick={() => toggleSelf()} className={styles.order_button}>{assignedToOrder ? 'Remove Self' : 'Add Self'}</Button>
            <Button variant="secondary" onClick={() => complete()} className={styles.order_button}>Complete</Button>
          </>
        :
          <></>
      }
    </div>
  );
}

function OrderList({ listData, isUserOwned, userId, loadContent }) {
  return (
    <div className={styles.order_list}>
      <h3>{listData.name} ({listData.list.length})</h3>
      {
        listData.list.map((order) => {
          return <Order key={order.id} data={order} 
                        isUserOwned={isUserOwned} userId={userId}
                        loadContent={loadContent} interactable={listData.interactable} />
        })
      }
    </div>
  );
}

function OrderContent() {
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState(undefined);
  const [orderLists, setOrderLists] = useState([]);

  const searchParams = useSearchParams();
  const restaurantId = searchParams.get('id');
  let loadUserOrders = false;
  if (restaurantId == undefined || restaurantId === '') {
    loadUserOrders = true;
  } else {
    if (restaurantId.includes('.'))
      return notFound();
    if (restaurantId.includes('/'))
      return notFound();
  }

  async function getItemInfo(itemId, variantId, restaurantId, nameLookup) {
    const info = {
      name: '',
      variant_name: '',
      id: ''
    };
    let itemData = undefined;

    // Check lookup table for the name first
    if (typeof nameLookup[itemId] === 'string') {
      info.name = nameLookup[itemId];
    } else {
      // Do full item lookup...
      itemData = await fetchAPI(`/restaurant/${restaurantId}/item/${itemId}`);
      if (itemData === undefined || !itemData.success) {
        return undefined;
      }
      info.name = itemData.name;

      // Store this in the lookup for later
      nameLookup[itemId] = info.name;
    }

    // Check lookup table for the variant name first
    if (typeof nameLookup[variantId] === 'string') {
      info.variant_name = nameLookup[variantId];
    } else {
      // Reuse item data lookup if possible. If not, look it up here:
      if (itemData === undefined) {
        itemData = await fetchAPI(`/restaurant/${restaurantId}/${itemId}`);
        if (itemData === undefined || !itemData.success) {
          return undefined;
        }
      }

      // Search for variant inside of item data
      let foundIndex = -1;
      let i = 0;
      for (const variant of itemData.variants) {
        if (variant.id === variantId) {
          foundIndex = i;
          break;
        }
        i++;
      }
      if (foundIndex === -1) {
        return undefined;
      }

      info.variant_name = itemData.variants[foundIndex].name;

      // Store this in the lookup for later
      nameLookup[variantId] = info.variant_name;
    }

    info.id = itemId + '-' + variantId;
    return info;
  }

  async function getUserInfo(userId) {
    const data = await fetchAPI(`/user/${userId}`);
    if (data === undefined || !data.success) {
      return undefined;
    }
    return { id: userId, name: data.name, email: data.email };
  }

  async function getRestaurantInfo(restaurantId) {
    const data = await fetchAPI(`/restaurant/${restaurantId}`);
    if (data === undefined || !data.success) {
      return undefined;
    }
    return { name: data.name };
  }

  async function loadOrderList(name, interactable, arrayOfOrderIds, nameLookup) {
    const list = [];
    for (const id of arrayOfOrderIds) {
      const data = await fetchAPI(`/order/${id}`);
      if (data === undefined || !data.success) {
        console.error('Failed to load order with ID ' + id);
        continue;
      }

      const items = [];
      for (const item of data.items) {
        const info = await getItemInfo(item.item_id, item.variant_id, data.restaurant, nameLookup);
        info.quantity = item.quantity;
        items.push(info);
      }

      const workers = [];
      for (const worker of data.workers) {
        workers.push(await getUserInfo(worker));
      }

      list.push({
        id: data.id,
        completed: data.completed,
        canceled: data.canceled,
        time_ordered: unixTimestampToString(data.time_ordered),
        time_completed: unixTimestampToString(data.time_completed),
        restaurant: await getRestaurantInfo(data.restaurant),
        user: await getUserInfo(data.user),
        items,
        workers
      });
    }

    return { name, list, interactable };
  }

  async function loadContent() {
    const nameLookup = {};

    // Load in all order IDs
    const data = await fetchAPI(loadUserOrders ? `/order` : `/restaurant/${restaurantId}/order`);
    if (data === undefined || !data.success) {
      alert('Failed to load orders.');
      return;
    }

    // Load in data for all the orders
    const newOrderLists = [];
    newOrderLists.push(await loadOrderList('Active Orders', true, data.active, nameLookup));
    newOrderLists.push(await loadOrderList('Past Orders', false, data.past, nameLookup));
    setOrderLists(newOrderLists);

    setLoaded(true);
  }

  useEffect(async () => {
    const sessionData = await fetchAPI('/session');
    if (sessionData === undefined || !sessionData.success) {
      alert('Failed to load session data!');
      return;
    }
    setUserId(sessionData.id);

    await loadContent();
  }, []);

  if (!loaded) {
    return <Container><Row><p style={{ marginTop: '64px' }}>Loading...</p></Row></Container>;
  }

  return (
    <>
      <h1 className={styles.title}>
        Orders
      </h1>
      <br/>
      <Container>
        <Row>
          {
            orderLists.map((list) => {
              return <OrderList key={list.name} listData={list} 
                                userId={userId} isUserOwned={loadUserOrders}
                                loadContent={loadContent} />;
            })
          }
        </Row>
      </Container>
    </>
  );
}

export default function Orders() {
  return (
    <main className="content p-3 mx-auto">
      <ChewNavbar/>
      <Suspense>
        <OrderContent/>
      </Suspense>
    </main>
  );
}
