'use client';

import React, { useState, useEffect } from 'react';
import styles from "./page.module.css";
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import ChewNavbar from '../navbar.js';
import { fetchAPI } from '../util'; 
import { useSnackbar } from 'react-simple-snackbar';

export default function Home() {
  const [name, setName] = useState('');
  const [openSnackbar, closeSnackbar] = useSnackbar();

  const handleNameSubmit = async (event) => {
    event.preventDefault(); // Prevent the default form submission

    const response = await fetchAPI('/user/update-name', 'PUT', JSON.stringify({ name }));
    
    if (response && response.success) {
      console.log('Name updated successfully');
      openSnackbar(`Name updated to "${name}"`)
    } else {
      console.error('Failed to update name:', response ? response.error : 'No response from server');
      openSnackbar('ERROR: Failed to update name');
    }
  };

  useEffect(async () => {
    const sessionData = await fetchAPI('/session');
    if (sessionData === undefined || !sessionData.success) {
      return;
    }
    const userData = await fetchAPI(`/user/${sessionData.id}`);
    if (userData === undefined || !userData.success) {
      return;
    }
    setName(userData.name);
  }, []);

  return (
    <main className="content p-3 mx-auto">
      <ChewNavbar />
      <h1 className={styles.title}>Personal Profile</h1>
      <br />
      <Container>
        <Row>
          <Col className="col-md-6">
            <img className={styles.pfp} src="/static/profile_pic.jpg" width="200" height="200" alt="Profile picture"/>
          </Col>
          <Col className="col-md-6">
            <Form onSubmit={handleNameSubmit}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  id="name"
                  className={styles.box}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <Button type="submit" className="mt-2">Update Name</Button>
              </Form.Group>
            </Form>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
