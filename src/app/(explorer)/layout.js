import "../app.css";
import "@/components/Button.css";
import "@/components/Form.css";
import "@/components/Modal.css";
import "./explorer.css";
import "@appwrite.io/pink-icons";
import { Navigation, Footer } from "@/components";

export const metadata = {
  title: "Base de Conocimiento",
  description: "Explorador de entidades",
};

export default function ExplorerLayout({ children }) {
  return (
    <>
      <Navigation />
      {children}
      <Footer />
    </>
  );
}
