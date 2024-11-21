'use client';

import styles from "./navbar.module.css";
import { Navbar } from 'react-bootstrap';
import { Nav, Container, NavbarBrand, NavLink, NavbarCollapse, NavbarToggle } from 'react-bootstrap';
import { fetchAPI } from './util.js';
import { useEffect, useState } from 'react';

export default function ChewNavbar() {
  const [dashboard, setDashboard] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  async function signOut() {
    const result = await fetchAPI('/signout', 'POST');
    if (result.success !== true) {
      alert('Failed to log out: ' + result.error);
      return;
    }
    window.location.replace('/');
  }

  useEffect(async () => {
    const sessionDataPromise = fetchAPI('/session', 'GET');
    const data = await fetchAPI('/signedin', 'GET');
    if (data.success === true && data.signed_in !== true) {
      window.location.replace('/');
      return;
    }

    const sessionData = await sessionDataPromise;
    if (sessionData !== undefined && sessionData.success && !sessionData.normal_user) {
      setDashboard(true);
    }

    setLoaded(true);
  }, []);

  return (
    <Navbar expand='lg' className={'navbar-dark ' + (loaded ? styles.navbar_custom : styles.navbar_custom_loading)}>
      <Container fluid>
        { 
          loaded ? 
            <>
              <NavbarBrand href="/home">
                <img
                  src="/static/icon_small.png"
                  width="32"
                  height="32"
                  className="d-inline-block align-middle"
                  alt="Chew Chew Train logo"
                />
                <span className="align-middle" style={{ marginLeft: '8px' }}>Chew Chew Train</span>
              </NavbarBrand>
              <NavbarToggle />
              <NavbarCollapse id="basic-navbar-nav">
                <Nav className="me-auto">
                  <NavLink href="/home">Home</NavLink>
                  <NavLink href="/orders">My Orders</NavLink>
                  <NavLink href="/feedback">Feedback</NavLink>
                  {
                    dashboard ? <NavLink href="/dashboard">Dashboard</NavLink> : <></>
                  }
                </Nav>
                <Nav className="ml-auto">
                  <NavLink href="/profile">My Profile</NavLink>
                  <NavLink onClick={() => signOut()}>Logout</NavLink>
                </Nav>
              </NavbarCollapse>
            </>
          :
            <>
              <NavbarBrand href="/home" style={{ opacity: '0%' }}>Chew Chew Train</NavbarBrand>
              <NavbarToggle />
            </>
        }
      </Container>
    </Navbar>
  );
}