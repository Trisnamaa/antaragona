import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Shield, CreditCard, Image, User, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function CreateProfile() {
  const location = useLocation();
  const navigate = useNavigate();
  const { character, username } = location.state || {};
  const [danaNumber, setDanaNumber] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ Fungsi validasi username
  const isValidUsername = (name: string) => {
    const regex = /^[A-Za-z]{1,8}$/;
    return regex.test(name);
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!character || !username) {
      toast.error('Character data is incomplete');
      return;
    }

    // ✅ Validasi username
    if (!isValidUsername(username)) {
      toast.error('Username hanya boleh huruf (A-Z) dan maksimal 8 karakter');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Please login first');
        navigate('/login');
        return;
      }

      const { error } = await supabase.from('profiles').insert({
        user_id: user.id,
        username,
        character_type: character,
        dana_number: danaNumber,
        profile_image_url: profileImage,
      });

      if (error) {
        if (error.message.includes('username')) {
          toast.error('Username already taken');
        } else {
          toast.error('Failed to create profile');
        }
        return;
      }

      toast.success('Profile created successfully!');
      navigate('/profile');
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen rpg-bg p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-lg mb-4 rpg-glow">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 rpg-text-glow">Create Profile</h1>
          <p className="text-gray-300">Complete your character setup</p>
        </div>

        <div className="rpg-card">
          {/* Character Info Display */}
          <div className="rpg-card-accent mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-600 rounded-xl mb-3">
              <User className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-1">{username}</h3>
            <p className="text-sm text-gray-300 capitalize">{character} Character</p>
          </div>

          <form onSubmit={handleCreateProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <CreditCard className="w-4 h-4 inline mr-2" />
                Dana Number
              </label>
              <input
                type="text"
                value={danaNumber}
                onChange={(e) => setDanaNumber(e.target.value)}
                className="input-modern w-full"
                placeholder="Enter your Dana number"
                required
              />
              <p className="text-sm text-gray-400 mt-1">For in-game transactions</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Image className="w-4 h-4 inline mr-2" />
                Profile Image URL
              </label>
              <input
                type="url"
                value={profileImage}
                onChange={(e) => setProfileImage(e.target.value)}
                className="input-modern w-full"
                placeholder="https://example.com/image.jpg"
                required
              />
              <p className="text-sm text-gray-400 mt-1">URL to your profile image</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-success w-full btn-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Character...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Create Character
                </div>
              )}
            </button>
          </form>
        </div>

        {/* Decorative Elements */}
        <div className="mt-8 flex justify-center space-x-2">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}
