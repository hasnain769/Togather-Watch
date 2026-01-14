'use client';

import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const router = useRouter();

  const createRoom = () => {
    const roomId = uuidv4();
    router.push(`/room/${roomId}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20 pointer-events-none"></div>

      <div className="z-10 text-center space-y-8 max-w-2xl">
        <h1 className="text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-4 animate-fade-in-up">
          CineSync
        </h1>
        <p className="text-xl text-gray-300 mb-8 leading-relaxed">
          Watch videos together in real-time with perfect synchronization and high-quality voice chat.
          No sign-up required.
        </p>

        <button
          onClick={createRoom}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-blue-600 font-pj rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-1"
        >
          <span>Create New Room</span>
          <svg className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>

      <div className="fixed bottom-8 text-xs text-gray-600">
        MVP Version 1.0 • Built with Next.js, Socket.io & WebRTC
      </div>
    </main>
  );
}
