/**
 * Point d'entrée React (Jour 7)
 * Monte l'application dans le DOM et enveloppe avec BrowserRouter pour le routage.
 * Chaque ligne est commentée pour expliquer son rôle.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';

// Récupération de l'élément DOM racine (div#root dans index.html)
const rootElement = document.getElementById('root');

// Création de la racine React 18 (createRoot permet le mode concurrent)
const root = createRoot(rootElement);

// Rendu de l'application : BrowserRouter permet l'utilisation de useNavigate, Link, Routes, etc.
root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
