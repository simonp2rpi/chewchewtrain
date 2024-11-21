'use client';

import styles from "./page.module.css";
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import ChewNavbar from '../navbar.js';
import { useEffect, useState, Suspense } from 'react';
import { fetchAPI } from '../util.js';

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(undefined);

  useEffect(async () => {
    const data = await fetchAPI('/restaurant');
    setData(data);
    setLoaded(true);
  }, []);

  if (!loaded)
    return <Suspense/>;
  if (data === undefined || !data.success)
    return notFound();

  return (
    <main className="content p-3 mx-auto">
      <ChewNavbar/>
      <h1 className={styles.title}>Choose a restaurant!</h1>
      <br/>
      <Row className="align-items-start text-center">
        {
          data.list.map((restaurant, i) => {
            return (
              <Col key={i} sm={4} style={{ marginBottom: '36px' }}>
                <a href={`/menus/?id=${restaurant.id}`}>
                  <img src={restaurant.image} width="150" height="100"/>
                  {restaurant.name}
                </a>
              </Col>
            );
          })
        }
      </Row>
    </main>
  );
}
