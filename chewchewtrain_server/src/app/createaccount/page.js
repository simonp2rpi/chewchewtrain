'use client';

import styles from "./page.module.css";
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import ChewNavbar from '../navbar.js';
import { fetchAPI } from '../util.js';

export default function Page() {
  function getFormData() {
    const formData = {
      name: document.forms['signup-form'].elements['full-name'].value,
      email: document.forms['signup-form'].elements['rpi-email'].value,
      password: document.forms['signup-form'].elements['password'].value
    };
    return formData;
  }

  async function signUp() {
    const data = getFormData(); 
    const result = await fetchAPI('/signup', 'POST', JSON.stringify(data));
    if (result.success !== true) {
      alert(result.error);
    } else {
      window.location.assign('/home');
    }
  };

  return (
    <main className="content p-3 mx-auto">
      <h1 className={styles.title}>Join the Chew Chew Train</h1>
      <br/>
      <Container>
        <Row>
          <Col className="col-md-6 offset-md-3">
            <Form id="signup-form">
              <Form.Label>Full Name</Form.Label>
              <Form.Control id="full-name" className={styles.box} type="text" />
              <Form.Label>RPI Email</Form.Label>
              <Form.Control id="rpi-email" className={styles.box} type="email" />
              <Form.Label>Password</Form.Label>
              <Form.Control id="password" className={styles.box} type="password" />
              <div className={'text-center ' + styles.create_button}>
                <Button onClick={() => signUp()}>Sign Up</Button>
              </div>
            </Form>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
