"use client";

import Link from "next/link";
import "./Footer.css";

export default function Footer() {
    return (
        <footer className="explorer-footer border-t border-gray-200 py-8 mt-auto">
            <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                    <p className="font-bold text-lg">Base de Conocimiento</p>
                    <p className="text-sm text-gray-500">© {new Date().getFullYear()} Todos los derechos reservados.</p>
                </div>
                <nav className="flex gap-8">
                    <Link href="/statistics" className="nav-link flex items-center gap-2 hover:text-blue-600 transition-colors">
                        <span className="icon-activity" aria-hidden="true"></span>
                        <span>Estadísticas</span>
                    </Link>
                    <Link href="/import" className="nav-link flex items-center gap-2 hover:text-blue-600 transition-colors">
                        <span className="icon-code" aria-hidden="true">📥</span>
                        <span>Importar</span>
                    </Link>
                </nav>
            </div>
        </footer>
    );
}