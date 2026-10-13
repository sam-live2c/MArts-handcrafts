import React, { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Send, MessageCircle, ArrowLeft, X, Clock, ShieldCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import Logo from '../components/Logo';

const Contact: React.FC = () => {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Order & Pottery Inquiry');
  const [message, setMessage] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="w-full bg-[#FAF8F5] min-h-screen text-[#2B221B] font-sans flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-[100] bg-white border-b border-gray-100 shadow-xs">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleGoBack(navigate, '/')}
              className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-[17px] font-semibold text-gray-900 leading-tight">Contact Us</h1>
          </div>
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <Logo variant="dark" size="sm" showStoreTag={false} />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-10 sm:py-14">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-3">
          <span className="inline-block px-3 py-1 rounded-full bg-[#FAF0E6] text-xs font-semibold uppercase tracking-wider text-[#C85A32] border border-[#EADBCC]">
            Direct Atelier Connect
          </span>
          <h1 className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-[#2B221B]">
            We&apos;d Love to Hear from You
          </h1>
          <p className="text-xs sm:text-sm text-[#735A4C] leading-relaxed">
            Whether you have questions about custom terracotta vessels, stone statues, kiln firing schedules, or order logistics, our artisan desk is here to assist.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 sm:gap-10 items-start">
          {/* Contact Information Cards */}
          <div className="space-y-6">
            <div className="bg-white border border-[#EADBCC] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <h2 className="text-xs font-bold text-[#A89283] uppercase tracking-wider">
                Atelier Information
              </h2>

              <div className="space-y-5">
                <div className="flex gap-3.5 items-start">
                  <div className="w-10 h-10 bg-[#FAF0E6] text-[#C85A32] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#A89283] uppercase tracking-wider mb-0.5">Telephone &amp; WhatsApp</p>
                    <a href="tel:+917061671820" className="text-sm font-bold text-[#2B221B] hover:text-[#C85A32] transition-colors">
                      +91 70616 71820
                    </a>
                  </div>
                </div>

                <div className="flex gap-3.5 items-start">
                  <div className="w-10 h-10 bg-[#FAF0E6] text-[#C85A32] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#A89283] uppercase tracking-wider mb-0.5">Email Support</p>
                    <div className="flex flex-col gap-0.5">
                      <a href="mailto:martsindia3@gmail.com" className="text-sm font-bold text-[#2B221B] hover:text-[#C85A32] transition-colors">
                        martsindia3@gmail.com
                      </a>
                      <a href="mailto:akmarts1511@gmail.com" className="text-xs text-[#735A4C] hover:text-[#C85A32] transition-colors">
                        akmarts1511@gmail.com
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3.5 items-start">
                  <div className="w-10 h-10 bg-[#FAF0E6] text-[#C85A32] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#A89283] uppercase tracking-wider mb-0.5">Showroom &amp; Atelier</p>
                    <p className="text-xs sm:text-sm font-medium text-[#4E392D] leading-relaxed">
                      Vill. Asanbani, P.O. Chandra, P.S. Siyaljori, Dist. Bokaro, Jharkhand, India
                    </p>
                    <p className="text-[11px] text-[#A89283] mt-1 font-medium">Founder: Anant Kumbhakar (Uart / MArts)</p>
                  </div>
                </div>

                <div className="flex gap-3.5 items-start">
                  <div className="w-10 h-10 bg-[#FAF0E6] text-[#C85A32] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#A89283] uppercase tracking-wider mb-0.5">Working Hours</p>
                    <p className="text-xs text-[#5E473A]">Mon – Sat: 10:00 AM – 7:00 PM IST</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#FAF0E6] border border-[#EADBCC] rounded-3xl p-6 flex items-center gap-3">
              <ShieldCheck size={28} className="text-[#C85A32] shrink-0" />
              <div className="text-xs text-[#6E5343]">
                <p className="font-bold text-[#2B221B]">Direct Artisan Transparency</p>
                <p>Directly managed by Anant Kumbhakar and master guild craftspersons.</p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 bg-white border border-[#EADBCC] rounded-3xl p-6 sm:p-10 shadow-xs relative">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-in zoom-in-95 duration-300 space-y-4">
                <div className="w-16 h-16 bg-[#FAF0E6] text-[#C85A32] rounded-full flex items-center justify-center">
                  <Send size={28} />
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-black text-[#2B221B]">Message Received!</h2>
                <p className="text-xs sm:text-sm text-[#735A4C] max-w-md">
                  Thank you for writing to MArts. A guild coordinator will review your inquiry and reach back within 24 business hours.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setFullName('');
                    setEmail('');
                    setMessage('');
                  }}
                  className="mt-4 px-6 py-2.5 bg-[#C85A32] text-white rounded-xl text-xs font-bold hover:bg-[#A04724] transition-colors cursor-pointer"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-bold text-[#4E392D] block mb-1.5">Full Name *</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        maxLength={60}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Meera Sen"
                        required
                        className="w-full p-3.5 pr-10 bg-[#FAF8F5] border border-[#EADBCC] rounded-xl outline-none focus:ring-2 focus:ring-[#C85A32]/30 focus:border-[#C85A32] transition-all font-medium text-xs sm:text-sm text-[#2B221B]"
                      />
                      {fullName.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFullName('')}
                          className="absolute right-3 p-1 text-[#A89283] hover:text-[#2B221B] rounded-full transition-colors cursor-pointer"
                          aria-label="Clear full name"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#4E392D] block mb-1.5">Email Address *</label>
                    <div className="relative flex items-center">
                      <input
                        type="email"
                        maxLength={100}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. meera@example.com"
                        required
                        className="w-full p-3.5 pr-10 bg-[#FAF8F5] border border-[#EADBCC] rounded-xl outline-none focus:ring-2 focus:ring-[#C85A32]/30 focus:border-[#C85A32] transition-all font-medium text-xs sm:text-sm text-[#2B221B]"
                      />
                      {email.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setEmail('')}
                          className="absolute right-3 p-1 text-[#A89283] hover:text-[#2B221B] rounded-full transition-colors cursor-pointer"
                          aria-label="Clear email"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4E392D] block mb-1.5">Inquiry Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-3.5 bg-[#FAF8F5] border border-[#EADBCC] rounded-xl outline-none focus:ring-2 focus:ring-[#C85A32]/30 focus:border-[#C85A32] transition-all font-medium text-xs sm:text-sm text-[#2B221B]"
                  >
                    <option>Order &amp; Pottery Inquiry</option>
                    <option>Custom Handcrafted Commission</option>
                    <option>Shipping &amp; Wooden Crate Care</option>
                    <option>Wholesale &amp; Interior Designer Guild</option>
                    <option>Other Questions</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4E392D] block mb-1.5">Message / Note *</label>
                  <div className="relative">
                    <textarea
                      rows={5}
                      maxLength={1000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share details of your question or the piece you are inquiring about..."
                      required
                      className="w-full p-3.5 pr-10 bg-[#FAF8F5] border border-[#EADBCC] rounded-xl outline-none focus:ring-2 focus:ring-[#C85A32]/30 focus:border-[#C85A32] transition-all font-medium text-xs sm:text-sm text-[#2B221B] resize-none"
                    />
                    {message.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMessage('')}
                        className="absolute right-3 top-3 p-1 text-[#A89283] hover:text-[#2B221B] rounded-full transition-colors cursor-pointer"
                        aria-label="Clear message"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Submit Message</span>
                  <Send size={15} />
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Contact;
