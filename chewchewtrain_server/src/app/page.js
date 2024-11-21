'use client';

import styles from "./page.module.css";
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { connectToFirebase, fetchAPI, getCookie } from './util.js';

export default function Login() {
  function getFormData() {
    const formData = {
      email: document.forms['login-form'].elements['login-email'].value,
      password: document.forms['login-form'].elements['login-password'].value
    };
    return formData;
  }

  function signIn() {
    const { firebaseApp, firebaseAuth } = connectToFirebase();
    const { email, password } = getFormData(); 

    signInWithEmailAndPassword(firebaseAuth, email, password).then(async (event) => {
      if (event == undefined || event.user == undefined)
        return;

      const idToken = await event.user.getIdToken();

      const csrfToken = getCookie('csrfToken');
      const result = await fetchAPI('/signin', 'POST', JSON.stringify({ id_token: idToken, csrfToken }));
      if (result.success !== true) {
        alert(result.error);
      }

      await firebaseAuth.signOut();

      if (result.success === true) {
        window.location.assign('/home');
      }
    }).catch((error) => {
      if (error != undefined && error.code === 'auth/invalid-credential')
        alert('Invalid credentials.');
      else if (error != undefined && error.code === 'auth/invalid-email')
        alert('Invalid email.');
      else
        alert('Error validating credentials.');
    });
  };

  return (
    <main className="content p-3 mx-auto">
      <h1>Welcome to Chew Chew Train</h1>
      <img src="/static/icon.png" width="300" height="300" alt="Logo" />
      <Container>
        <Row>
          <Col className="col-md-6 offset-md-3">
            <Form id="login-form">
              <Form.Label>RPI Email</Form.Label>
              <Form.Control id="login-email" className={styles.box} type="email" />
              <Form.Label>Password</Form.Label>
              <Form.Control id="login-password" className={styles.box} type="password" />
              <div className={'text-center ' + styles.login_button}>
                <Button onClick={() => signIn()}>Login</Button>
              </div>
            </Form>
            <div className={styles.create}>
              <a href="/createaccount">Don't have one? Create an Account!</a>
            </div>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
