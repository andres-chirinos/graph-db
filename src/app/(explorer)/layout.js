import "../app.css";
import "./explorer.css";
import "@appwrite.io/pink-icons";

export const metadata = {
  title: "Graph DB Explorer",
  description: "Explorador de entidades estilo Wikidata",
};

export default function ExplorerLayout({ children }) {
  return children;
}
