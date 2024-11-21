'use client';

import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { Container, Row, Col, Button, Form, Modal } from 'react-bootstrap';
import ChewNavbar from '../navbar.js';
import { useEffect, useState, Suspense } from 'react';
import { fetchAPI, fetchFormDataAPI } from '../util.js';
import { useSnackbar } from 'react-simple-snackbar';

function DashboardContent() {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(undefined);
  const [newRestaurantView, setNewRestaurantView] = useState(false);
  const [newRestaurantName, setNewRestaurantName] = useState('');
  const [addPersonView, setAddPersonView] = useState(false);
  const [addPersonEmail, setAddPersonEmail] = useState('');
  const [addPersonType, setAddPersonType] = useState('');
  const [addPersonRestaurant, setAddPersonRestaurant] = useState(undefined);
  const [deleteRestaurantView, setDeleteRestaurantView] = useState(false);
  const [deleteRestaurantRestaurant, setDeleteRestaurantRestaurant] = useState(undefined);
  const [deleteRestaurantText, setDeleteRestaurantText] = useState('');
  const [openSnackbar, closeSnackbar] = useSnackbar();

  async function reloadData() {
    const restaurantData = await fetchAPI('/restaurant');

    const data = {
      restaurants: [],
      admin: false
    };

    // Check if user is an admin
    const adminData = await fetchAPI('/session/admin');
    if (adminData !== undefined && adminData.success) {
      data.admin = adminData.admin;
    }

    // Add restaurants that we have access to
    for (const restaurant of restaurantData.list) {
      const statusData = await fetchAPI(`/session/restaurant?id=${restaurant.id}`);
      if (statusData !== undefined && statusData.success) {
        if (statusData.status !== 'user') {
          // Get workers and owners of this restaurant
          const workerData = await fetchAPI(`/restaurant/${restaurant.id}/workers`);
          if (workerData === undefined || !workerData.success) {
            continue;
          }
          const ownerData = await fetchAPI(`/restaurant/${restaurant.id}/owners`);
          if (ownerData === undefined || !ownerData.success) {
            continue;
          }

          // Compile list of names and emails of users
          const workers = [];
          const owners = [];
          for (const worker of workerData.list) {
            const userData = await fetchAPI(`/user/${worker}`);
            workers.push({
              name: userData.name,
              email: userData.email,
              id: worker
            });
          }
          for (const owner of ownerData.list) {
            const userData = await fetchAPI(`/user/${owner}`);
            owners.push({
              name: userData.name,
              email: userData.email,
              id: owner
            });
          }

          // Add to restaurant list
          data.restaurants.push({
            name: restaurant.name,
            id: restaurant.id,
            status: statusData.status,
            workers,
            owners
          });
        }
      }
    }

    setData(data);
  }

  function addWorker(restaurant) {
    setAddPersonEmail('');
    setAddPersonType('worker');
    setAddPersonRestaurant(restaurant);
    setAddPersonView(true);
  }
  function addOwner(restaurant) {
    setAddPersonEmail('');
    setAddPersonType('owner');
    setAddPersonRestaurant(restaurant);
    setAddPersonView(true);
  }
  async function removeWorker(restaurant, workerId) {
    const removeData = await fetchAPI(`/restaurant/${restaurant.id}/workers/${workerId}`, 'DELETE');
    if (removeData === undefined || !removeData.success) {
      openSnackbar('ERROR: Failed to remove worker');
      return;
    }
    openSnackbar('Removed worker.');
    await reloadData();
  }
  async function removeOwner(restaurant, ownerId) {
    const removeData = await fetchAPI(`/restaurant/${restaurant.id}/owners/${ownerId}`, 'DELETE');
    if (removeData === undefined || !removeData.success) {
      openSnackbar('ERROR: Failed to remove owner');
      return;
    }
    openSnackbar('Removed owner.');
    await reloadData();
  }
  function addRestaurant() {
    setNewRestaurantName('');
    setNewRestaurantView(true);
  }
  function deleteRestaurant(restaurant) {
    setDeleteRestaurantText('no');
    setDeleteRestaurantRestaurant(restaurant);
    setDeleteRestaurantView(true);
  }

  useEffect(async () => {
    await reloadData();
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <p>Loading...</p>
    );
  }

  return (
    <>
      {
        data.restaurants.map((restaurant, i) => {
          return (
            <div key={i} style={{ marginBottom: '36px' }}>
              <h4>
                {restaurant.name}
                {
                  data.admin ?
                    <>
                      {' '}<a className={styles.text_delete} href="#" onClick={() => deleteRestaurant(restaurant)}>(Delete)</a>
                    </>
                  :
                    <></>
                }
              </h4>
              <div style={{ marginLeft: '16px' }}>
                <p>
                  View live page <a className={styles.link} href={`/menus/?id=${restaurant.id}`}>here</a>.<br/>
                  Edit page <a className={styles.link} href={`/menus/edit/?id=${restaurant.id}`}>here</a>.<br/>
                  View orders <a className={styles.link} href={`/orders/?id=${restaurant.id}`}>here</a>.
                </p>
                <p style={{ marginBottom: '4px' }}>Workers:</p>
                <ul>
                  {
                    restaurant.workers.map((worker, j) => {
                      return (
                        <li key={j}>
                          {worker.name} ({worker.email})
                          {
                            restaurant.status === 'owner' ?
                              <>{' '}<Button variant="secondary" type="button" onClick={() => removeWorker(restaurant, worker.id)}>Remove</Button></>
                            :
                              <></>
                          }
                        </li>
                      );
                    })
                  }
                  {
                    restaurant.status === 'owner' ?
                      <li key={"last"}><a href="#" className={styles.text_edit} onClick={() => addWorker(restaurant)}>Add worker</a></li>
                    :
                      <></>
                  }
                </ul>
                <p style={{ marginBottom: '4px' }}>Owners:</p>
                <ul>
                  {
                    restaurant.owners.map((owner, j) => {
                      return (
                        <li key={j}>
                          {owner.name} ({owner.email})
                          {
                            data.admin ?
                              <>{' '}<Button variant="secondary" type="button" onClick={() => removeOwner(restaurant, owner.id)}>Remove</Button></>
                            :
                              <></>
                          }
                        </li>
                      );
                    })
                  }
                  {
                    data.admin ?
                      <li key={"last"}><a href="#" className={styles.text_edit} onClick={() => addOwner(restaurant)}>Add owner</a></li>
                    :
                      <></>
                  }
                </ul>
              </div>
            </div>
          );
        })
      }
      {
        data.admin ?
          <Button className={styles.add_restaurant_button} variant="secondary" type="button" onClick={() => addRestaurant()}>Add restaurant</Button>
        :
          <></>
      }
      <Modal data-bs-theme="dark" backdrop="static" show={newRestaurantView} onHide={() => setNewRestaurantView(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add new restaurant</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <form onSubmit={e => e.preventDefault()}>
            <label style={{ margin: '8px' }} for="new-restaurant-name">Name of restaurant:</label>
            <input id="new-restaurant-name" style={{ width: "100%" }} type="text" value={newRestaurantName} onInput={e => setNewRestaurantName(e.target.value)} />
            <label style={{ margin: '8px' }} for="image-upload">Thumbnail image:</label>
            <input type="file" name="image-upload" id="image-upload" />
          </form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setNewRestaurantView(false)}>Close</Button>
          <Button variant="primary" onClick={async () => {
            const formData = new FormData();
            formData.append('name', newRestaurantName);
            formData.append('image', document.getElementById('image-upload').files[0]);
            const newRestaurantData = await fetchFormDataAPI('/restaurant', 'POST', formData);
            if (newRestaurantData === undefined || !newRestaurantData.success) {
              openSnackbar('ERROR: Failed to create restaurant');
              return;
            }
            openSnackbar(`Created new restaurant "${newRestaurantName}".`);
            setNewRestaurantView(false);
            await reloadData();
          }}>
            Add Restaurant
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal data-bs-theme="dark" backdrop="static" show={addPersonView} onHide={() => setAddPersonView(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add {addPersonType} to {addPersonRestaurant?.name ?? ''}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <form onSubmit={e => e.preventDefault()}>
            <label for="new-person-email">Enter email:</label>
            <input id="new-person-email" style={{ width: "100%" }} type="text" value={addPersonEmail} onInput={e => setAddPersonEmail(e.target.value)} />
          </form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAddPersonView(false)}>Close</Button>
          <Button variant="primary" onClick={async () => {
            const addPersonData = await fetchAPI(`/restaurant/${addPersonRestaurant.id}/${addPersonType}s`, 'POST', JSON.stringify({
              user_email: addPersonEmail
            }));
            if (addPersonData === undefined || !addPersonData.success) {
              openSnackbar(`ERROR: Failed to add ${addPersonType}`);
              return;
            }
            openSnackbar(`Added new ${addPersonType} to ${addPersonRestaurant.name}.`);
            setAddPersonView(false);
            await reloadData();
          }}>
            Add
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal data-bs-theme="dark" backdrop="static" show={deleteRestaurantView} onHide={() => setDeleteRestaurantView(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete {deleteRestaurantRestaurant?.name ?? ''}?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <form onSubmit={e => e.preventDefault()}>
            <label for="delete-restaurant-text">Type "yes" to confirm:</label>
            <input id="delete-restaurant-text" style={{ width: "100%" }} type="text" value={deleteRestaurantText} onInput={e => setDeleteRestaurantText(e.target.value)} />
          </form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteRestaurantView(false)}>Close</Button>
          <Button variant="primary" onClick={async () => {
            if (deleteRestaurantText !== 'yes') {
              openSnackbar(`Didn't delete anything.`);
              return;
            }

            const deleteRestaurantData = await fetchAPI(`/restaurant/${deleteRestaurantRestaurant.id}`, 'DELETE');
            if (deleteRestaurantData === undefined || !deleteRestaurantData.success) {
              openSnackbar(`ERROR: Failed to delete restaurant`);
              return;
            }
            openSnackbar(`Deleted restaurant "${deleteRestaurantRestaurant.name}".`);
            setDeleteRestaurantView(false);
            await reloadData();
          }}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default function Dashboard() {
  return (
    <main className="content p-3 mx-auto">
      <ChewNavbar/>
      <h1 className={styles.title}>Dashboard</h1>
      <br/>
      <Container>
        <Row>
          <DashboardContent/>
        </Row>
      </Container>
    </main>
  );
}
