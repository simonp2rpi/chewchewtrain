'use client';

import styles from "./page.module.css";
import React, { useState, useEffect} from 'react';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import ChewNavbar from '../navbar.js';
import { fetchAPI } from '../util.js';

export default function Page() {
  const [restaurants, setRestaurants] = useState([]);

  async function getRestaurantData() {
    const result = await fetchAPI('/restaurant', 'GET');
    if (result === undefined || result.success !== true) {
      alert(result?.error ?? 'Failed to load restaurant list');
    } else {
      //Store restaurant names into array
      let restNames = result.list.map((i) => {
        return i.name;
      })
      setRestaurants(restNames);
    }
  }

  //Fetch restaurant data
  useEffect(() => {
    getRestaurantData();
  }, [])

  function getFormData() {
    const formData = {
      restaurant: document.forms['signup-form'].elements['restaurant'].value,
      type: document.forms['signup-form'].elements['feedback-type'].value,
      feedback: document.forms['signup-form'].elements['message'].value,
      email: document.forms['signup-form'].elements['rpi-email'].value
    };
    return formData;
  }

  async function submit() {
    const data = getFormData();
    const result = await fetchAPI('/feedback', 'POST', JSON.stringify(data));
    if (result.success !== true) {
      alert(result.error);
    } else {
      window.location.assign('/home');
    }
  };

  return (
    <main className="content p-3 mx-auto">
      <ChewNavbar/>
      <h1 className={styles.title}>Issues? Submit Them Here!</h1>
      <br/>
      <Container>
        <Row>
          <Col className="col-md-6 offset-md-3">
            <Form id="signup-form">
              <Form.Label>Restaurant</Form.Label>
              <Form.Select id="restaurant" className={styles.box}>
                {
                  // Load restaurant names as options
                  restaurants.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))
                }
              </Form.Select>
              <Form.Label>Feedback Type</Form.Label>
              <Form.Select id="feedback-type" className={styles.box}>
                <option value="restaurant">Restaurant</option>
                <option value="previous-order">Previous Order</option>
                <option value="suggestion">Suggestion</option>
                <option value="other">Other</option>
              </Form.Select>
              <Form.Label>Message</Form.Label>
              <Form.Control id="message" className={styles.box} type="text" />
              <Form.Label>Contact Information (RPI Email)</Form.Label>
              <Form.Control id="rpi-email" className={styles.box} type="email" />
              <div className={'text-center ' + styles.create_button}>
                <Button onClick={() => submit()}>Submit</Button>
              </div>
            </Form>
            <br/><br/>
            <div className={styles.admin}>
              <a href="/feedback/admin" style={{ color: '#999999' }}>Are you a business partner? See responses here</a>
            </div>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
