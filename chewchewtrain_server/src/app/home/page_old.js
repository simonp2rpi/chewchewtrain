import styles from "./page.module.css";
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import ChewNavbar from '../navbar.js';

export default function Home() {
  return (
    <main className="content p-3 mx-auto">
      <ChewNavbar/>
      <h1 className={styles.title}>Choose a restaurant!</h1>
      <br/>
      <Row className="align-items-start text-center">
        <Col id="col-title">
          <a href="/menus/dcccafe">
            <img src="/static/dcccafe.jpg" width="150" height="100"/>
            DCC Cafe
          </a>
        </Col>
        <Col className={styles.col_mid} id="col-title">
          <a href="/menus/tmc">
            <img src="/static/tmc.jpg" width="150" height="100"/>
            Thunder Mountain Curry
          </a>
        </Col>
        <Col id="col-title">
          <a href="/menus/mrbeast">
            <img src="/static/mrbeast.png" width="150" height="100"/>
            Mr. Beast Burger
          </a>
        </Col>
      </Row>
      <br/>
      <Row className="align-items-start text-center">
        <Col id="col-title">
          <a href="/menus/wildblue">
            <img src="/static/wildblue.jpg" width="150" height="100"/>
            Wild Blue
          </a>
        </Col>
        <Col className={styles.col_mid} id="col-title">
          <a href="/menus/halalshack">
            <img src="/static/halal.jpg" width="150" height="100"/>
            Halal Shack
          </a>
        </Col>
        <Col id="col-title">
          <a href="/menus/argotea">
            <img src="/static/argotea.png" width="150" height="100"/>
            Argo Tea
          </a>
        </Col>
      </Row>
    </main>
  );
}
