'use client';

import SnackbarProvider from 'react-simple-snackbar';

export default function Body({ children }) {
  return (
    <SnackbarProvider>
      {children}
      <br/>
      <footer className="footer">Developed by ITWS 4500 Team 1 - The Munches</footer>
    </SnackbarProvider>
  );
}
