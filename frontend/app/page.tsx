'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaVideo, FaMicrophone, FaRocket, FaStar, FaShieldAlt, FaFilm } from 'react-icons/fa';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  const handleGetStarted = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/record');
  };

  const handleStartRecording = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/record');
  };

  const handleOpenEditor = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/editor');
  };

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-50 shadow-sm dark:shadow-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-primary">
            <FaVideo className="text-2xl" />
            <span className="text-xl font-bold">ProScreen</span>
          </div>
          <div className="flex gap-6 items-center">
            <a href="#features" className="hover:text-primary transition dark:text-gray-300">Features</a>
            <a href="#how-it-works" className="hover:text-primary transition dark:text-gray-300">How It Works</a>
            <button
              onClick={handleOpenEditor}
              className="hover:text-primary transition dark:text-gray-300"
            >
              Video Editor
            </button>
            <ThemeToggle />
            {isLoggedIn ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="hover:text-primary transition dark:text-gray-300"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="hover:text-primary transition dark:text-gray-300"
              >
                Login
              </button>
            )}
            <button onClick={handleGetStarted} className="btn btn-primary text-sm px-4 py-2">
              Start Recording
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-purple-600 to-blue-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute w-64 h-64 bg-white rounded-full -top-10 -left-10 animate-float"></div>
          <div className="absolute w-96 h-96 bg-white rounded-full -bottom-20 -right-20 animate-float" style={{animationDelay: '2s'}}></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                Professional
              </span>
              <br />
              Screen Recording
            </h1>
            <p className="text-xl mb-8 text-gray-100">
              Capture your screen and voice with crystal-clear quality. Perfect for tutorials, presentations, and content creation.
            </p>
            <div className="flex gap-4 mb-8">
              <div className="flex items-center gap-2">
                <FaStar className="text-yellow-400" />
                <span>10K+ Users</span>
              </div>
              <div className="flex items-center gap-2">
                <FaStar className="text-yellow-400" />
                <span>4.9/5 Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <FaRocket className="text-green-400" />
                <span>Free Forever</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleStartRecording} className="btn bg-white text-primary hover:bg-gray-100 text-lg">
              Start Recording Now - Free!
              </button>
              <button onClick={handleOpenEditor} className="btn bg-gray-900/20 text-white hover:bg-gray-900/30 text-lg border border-white/30">
                Open Video Editor
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 dark:text-gray-100">Powerful Features</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="card hover:scale-105 transition">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mb-4">
                <FaVideo className="text-white text-xl" />
              </div>
              <h3 className="text-xl font-bold mb-3 dark:text-gray-100">Screen Recording</h3>
              <p className="text-gray-600 dark:text-gray-400">Capture your entire screen or specific applications with high quality.</p>
            </div>

            <div className="card hover:scale-105 transition">
              <div className="w-12 h-12 bg-gradient-to-br from-success to-info rounded-full flex items-center justify-center mb-4">
                <FaMicrophone className="text-white text-xl" />
              </div>
              <h3 className="text-xl font-bold mb-3 dark:text-gray-100">Auto Transcription</h3>
              <p className="text-gray-600 dark:text-gray-400">Automatic speech-to-text in 11+ languages with AI enhancement.</p>
            </div>

            <div className="card hover:scale-105 transition">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mb-4">
                <FaFilm className="text-white text-xl" />
              </div>
              <h3 className="text-xl font-bold mb-3 dark:text-gray-100">Advanced Video Editor</h3>
              <p className="text-gray-600 dark:text-gray-400">Trim, cut, and polish recordings with an easy editor. No login needed.</p>
            </div>

            <div className="card hover:scale-105 transition">
              <div className="w-12 h-12 bg-gradient-to-br from-warning to-danger rounded-full flex items-center justify-center mb-4">
                <FaShieldAlt className="text-white text-xl" />
              </div>
              <h3 className="text-xl font-bold mb-3 dark:text-gray-100">Privacy First</h3>
              <p className="text-gray-600 dark:text-gray-400">Your recordings stay private. Everything stored locally in your browser. No cloud, no signup needed!</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6 bg-gray-100 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 dark:text-gray-100">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { num: '1', title: 'Choose Mode', desc: 'Select screen or voice recording' },
              { num: '2', title: 'Start Recording', desc: 'Click record and begin capturing' },
              { num: '3', title: 'Edit with AI', desc: 'Use AI to enhance and cleanup' },
              { num: '4', title: 'Export & Share', desc: 'Download or share your recording' },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold mb-2 dark:text-gray-100">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FaVideo className="text-2xl text-primary" />
            <span className="text-xl font-bold">ProScreen</span>
          </div>
          <p className="text-gray-400">Professional Screen & Voice Recording</p>
          <p className="text-gray-500 text-sm mt-4">&copy; 2026 ProScreen Recorder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
