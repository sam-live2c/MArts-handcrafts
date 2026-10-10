
import React, { useState, useEffect } from 'react';
import { CATEGORIES } from '../constants';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';

const FOR_YOU_IMAGES = [
  '/media/melody/regenerated_image_1788650309092.png',
  '/media/melody/wood_stand_1.jpg',
  '/media/melody/puck_disc_1.jpg',
];

const CategoryBar: React.FC = () => {
  const navigate = useNavigate();
  const [forYouImgIndex, setForYouImgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setForYouImgIndex((prev) => (prev + 1) % FOR_YOU_IMAGES.length);
    }, 2000); // Change image every 2 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white shadow-sm mb-2 border-b overflow-x-auto no-scrollbar scroll-smooth">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between py-4 gap-4 sm:gap-8 min-w-max">
        {CATEGORIES.map((cat) => {
          const isHot = cat.id === 'stands' || cat.id === 'pucks';
          const isForYou = cat.id === 'foryou';

          return (
            <button
              key={cat.id}
              onClick={() => {
                if (cat.id === 'stands' || cat.id === 'foryou') {
                  navigate('/product/1');
                } else if (cat.id === 'wood') {
                  navigate('/product/1');
                } else if (cat.id === 'pucks') {
                  navigate('/product/2');
                } else if (cat.id === 'multichannel') {
                  navigate('/product/3');
                } else if (cat.id === 'cards') {
                  navigate('/product/4');
                } else {
                  navigate('/');
                }
              }}
              className="flex flex-col items-center group cursor-pointer min-w-[4rem] sm:min-w-[5rem] relative active:scale-95 transition-all duration-300 flex-shrink-0 px-2"
            >
              {isHot && (
                <span className="absolute top-0 right-2 flex h-4 w-4 z-10 -translate-y-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white items-center justify-center">
                    <Zap size={6} fill="white" className="text-white" />
                  </span>
                </span>
              )}
              
              <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-2 transition-transform duration-300 group-hover:scale-110 relative overflow-hidden rounded-xl bg-gray-50 border border-gray-100 p-1">
                {isForYou ? (
                  <div 
                    className="w-full h-full flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateY(-${forYouImgIndex * 100}%)`, flexDirection: 'column' }}
                  >
                    {FOR_YOU_IMAGES.map((img, idx) => (
                      <img 
                        key={idx}
                        src={img} 
                        alt="For You"
                        className="w-full h-full object-contain flex-shrink-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                ) : (
                  <img 
                    src={cat.image} 
                    alt={cat.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              
              <span className="text-[10px] sm:text-xs font-bold text-gray-700 group-hover:text-[#1A73E8] text-center transition-colors max-w-[80px] leading-tight">
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryBar;
