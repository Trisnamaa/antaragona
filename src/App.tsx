import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Register from './pages/Register';
import Login from './pages/Login';
import CharacterSelect from './pages/CharacterSelect';
import Profile from './pages/Profile';
import CreateProfile from './pages/CreateProfile';
import Lobby from './pages/Lobby';
import Inventory from './pages/Inventory';
import Shop from './pages/Shop';
import Adventure from './pages/Adventure';
import Fishing from './pages/Fishing';
import Farming from './pages/Farming';
import Battle from './pages/Battle';
import TitleManager from './pages/TitleManager';
import DungeonGame from './pages/DungeonGame';
import RaidGame from './pages/RaidGame';
import Leaderboard from './pages/Leaderboard';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen rpg-bg text-white font-medieval">
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/character-select" element={<CharacterSelect />} />
          <Route path="/create-profile" element={<CreateProfile />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/adventure" element={<Adventure />} />
          <Route path="/fishing" element={<Fishing />} />
          <Route path="/farming" element={<Farming />} />
          <Route path="/battle" element={<Battle />} />
          <Route path="/titles" element={<TitleManager />} />
          <Route path="/dungeon/:dungeonId" element={<DungeonGame />} />
          <Route path="/raid/:roomUuid" element={<RaidGame />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-center" />
      </div>
    </BrowserRouter>
  );
}

export default App;