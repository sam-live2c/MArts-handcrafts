
import React from 'react';
import { CATEGORIES } from '../constants';
import { useNavigate } from 'react-router-dom';

const CategoryBar: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white shadow-xs mb-2 border-b border-gray-100 overflow-x-auto no-scrollbar scroll-smooth">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between py-4 gap-4 sm:gap-8 min-w-max">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              navigate('/products');
            }}
            className="flex flex-col items-center group cursor-pointer min-w-[4rem] sm:min-w-[5rem] relative active:scale-95 transition-all duration-300 flex-shrink-0 px-2"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-2 transition-transform duration-300 group-hover:scale-105 relative overflow-hidden rounded-xl bg-[#FAF7F2] border border-[#E8DFD8] p-1">
              <img 
                src={cat.image} 
                alt={cat.name}
                className="w-full h-full object-contain"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <span className="text-[10px] sm:text-xs font-bold text-gray-700 group-hover:text-[#C85A32] text-center transition-colors max-w-[80px] leading-tight">
              {cat.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryBar;
