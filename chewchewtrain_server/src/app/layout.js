import { Open_Sans } from "next/font/google";
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.css'; 
import Body from './layout_body.js';

const openSans = Open_Sans({ subsets: ["latin"] });

export const metadata = {
  title: "Chew Chew Train",
  description: "Keep your hunger on track!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={openSans.className}>
        <Body children={children}/>
      </body>
    </html>
  );
}
