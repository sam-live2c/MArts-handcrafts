import React, { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { ArrowLeft } from 'lucide-react';

export type PolicyType = 'privacy' | 'refunds' | 'terms' | 'shipping';

interface PolicyPageProps {
  type: PolicyType;
}

const PolicyPage: React.FC<PolicyPageProps> = ({ type }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Scroll to top on route change or policy type switch
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, type]);

  const headerTitles: Record<PolicyType, string> = {
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    refunds: 'Refunds & Replacement',
    shipping: 'Shipping & Delivery',
  };

  return (
    <div className="w-full bg-white min-h-screen text-gray-800 font-sans selection:bg-blue-100 flex flex-col">
      {/* Top Header Bar with separation line and page-specific headline beside back button */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-3 sm:py-3.5 flex items-center">
          <button
            type="button"
            onClick={() => handleGoBack(navigate, '/')}
            className="inline-flex items-center gap-2.5 text-gray-800 hover:text-gray-900 rounded-lg transition-colors cursor-pointer group"
            aria-label={`Go back from ${headerTitles[type]}`}
          >
            <ArrowLeft size={20} className="text-gray-700 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              {headerTitles[type]}
            </span>
          </button>
        </div>
      </header>

      {/* Main Document Body */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 pt-4 pb-12 sm:pt-6 sm:pb-16">
        {type === 'privacy' && <PrivacyPolicyContent />}
        {type === 'refunds' && <RefundPolicyContent />}
        {type === 'terms' && <TermsConditionsContent />}
        {type === 'shipping' && <ShippingPolicyContent />}
      </main>

      {/* Standard Merchant Legal Compliance Footer */}
      <footer className="w-full bg-[#FAF7F2] border-t border-[#EADBCC] py-10 px-4 sm:px-8 text-xs text-[#735A4C]">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 pb-8 border-b border-[#EADBCC]">
          <div>
            <h4 className="font-semibold text-[#2B221B] mb-2">Registered Atelier</h4>
            <p className="leading-relaxed">
              MArts Handcrafted Studio • Heritage Crafts Guild<br />
              Plot 14, Heritage Artisan Guild Enclave, Pottery &amp; Sculpture Crafts Zone,<br />
              Sector 4, Khurja / Bengal Craft Belt – 203131, India
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#2B221B] mb-2">Customer &amp; Atelier Support</h4>
            <p className="leading-relaxed">
              Phone &amp; WhatsApp:{' '}
              <a href="tel:+919876543210" className="text-[#C85A32] hover:underline font-medium">
                +91 98765 43210
              </a>
              <br />
              Email:{' '}
              <a href="mailto:atelier@marts.com" className="text-[#C85A32] hover:underline">
                atelier@marts.com
              </a>
              <br />
              Hours: Mon – Sat (10:00 AM – 7:00 PM IST)
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#2B221B] mb-2">Artisan Heritage &amp; Trust</h4>
            <p className="leading-relaxed">
              MArts Handcrafted Guild Ecosystem<br />
              100% Genuine Handcrafted Pieces<br />
              Eco-Friendly Kiln Ceramics &amp; Natural Stone<br />
              Compliant with DPDPA 2023 &amp; IT Act 2000
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[#A89283]">
          <p>© {new Date().getFullYear()} MArts Handcrafted Studio. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs font-medium">
            <Link to="/contact" className="hover:text-[#C85A32] transition-colors">Contact</Link>
            <Link to="/privacy-policy" className="hover:text-[#C85A32] transition-colors">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="hover:text-[#C85A32] transition-colors">Terms and Conditions</Link>
            <Link to="/about" className="hover:text-[#C85A32] transition-colors">About</Link>
            <Link to="/location" className="hover:text-[#C85A32] transition-colors">Location</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* =========================================================================
   1. PRIVACY POLICY & DATA PROTECTION (Matching User's Reference Screenshot)
   ========================================================================= */
const PrivacyPolicyContent: React.FC = () => {
  return (
    <article className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Privacy Policy &amp; Data Protection
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
          How we collect, utilize, and safeguard your merchant information and payment transactions in compliance with Indian and international privacy standards.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Operated by MArts Handcrafted Studio under the MArts Guild Ecosystem • Artisanal Pottery & Sculpture Guild
        </p>
      </div>

      {/* MArts Guild Umbrella Scope */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          MArts Guild Ecosystem &amp; Umbrella Scope
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          This store (<span className="font-semibold text-gray-900">MArts</span>) operates under the <span className="font-semibold text-gray-900">MArts Guild</span> ecosystem (managed by MArts / Sahanur Molla). Every website, portal, sub-domain, online hardware checkout, and digital service under the MArts Guild umbrella falls strictly under this unified Privacy Policy, Data Protection, and Terms of Service framework.
        </p>
      </section>

      {/* Payment Security & Zero Card Storage Guarantee */}
      <section className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5">
        <h2 className="font-bold text-gray-900 text-sm sm:text-base">
          Payment Security &amp; Zero Card Storage Guarantee
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 mt-2 leading-relaxed">
          All monetary transactions on <span className="font-semibold text-gray-900">MArts</span> are handled exclusively through <span className="font-semibold text-gray-900">Secure Payment Processing</span>, which adheres strictly to PCI-DSS Level 1 security standards. <span className="font-semibold text-gray-900">MArts Handcrafted Studio</span> does NOT record, retain, or store your credit/debit card numbers, CVVs, net banking credentials, or UPI PINs. All card transmissions take place over 256-bit TLS encrypted channels.
        </p>
        <p className="text-xs text-gray-500 mt-2.5">
          Applicable Laws: Digital Personal Data Protection Act 2023 (DPDPA) • IT Act 2000 Section 43A &amp; SPDI Rules 2011.
        </p>
      </section>

      {/* Nominal ₹2 Verification Refund & General Issues Notice */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          Nominal ₹2 Verification Refund &amp; Mandatory WhatsApp Support Clause
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          During payment method verification or 14-day free trial authorization, a nominal authentication charge of <span className="font-semibold text-gray-900">₹2</span> is processed securely and scheduled for an automatic refund.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          If a customer/merchant does not receive the ₹2 refund within <span className="font-semibold text-gray-900">5 to 7 business days</span>, or encounters any transaction issue, billing dispute, or whatever problem with their account or service, they are required to contact support directly via WhatsApp at{' '}
          <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="text-[#1A73E8] hover:underline font-semibold">
            +91 9876543210
          </a>{' '}
          with their transaction reference.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          <strong className="text-gray-900">Merchant/Customer Responsibility &amp; Disclaimer of Liability:</strong> Failure or delay to notify support via WhatsApp within <span className="font-semibold text-gray-900">30 days</span> shall be conclusively deemed a voluntary waiver and sole negligence of the customer/merchant. MArts (MArts, MArts Guild, and its operators) holds zero financial liability, responsibility, or further obligation for unnotified claims or unclaimed amounts.
        </p>
      </section>

      {/* 1. Data We Collect from Merchants */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          1. Data We Collect from Merchants
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          When you onboard your business, order physical standees, or subscribe to software services, we collect only data necessary to fulfill commercial and hardware obligations:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-gray-900">Contact Information:</strong> Full name, business email address, and phone number for order verification and merchant support.
          </li>
          <li>
            <strong className="text-gray-900">Business Profile Data:</strong> Business name, category, Google Business Place ID, and storefront address for NFC chip encoding.
          </li>
          <li>
            <strong className="text-gray-900">Shipping &amp; Delivery Details:</strong> Physical address, city, state, postal code, recipient name, and phone number for parcel shipment.
          </li>
          <li>
            <strong className="text-gray-900">Billing Metadata:</strong> Transaction identifiers, Payment Processing Payment IDs, and invoice dates. (No sensitive banking credentials).
          </li>
        </ul>
      </section>

      {/* 2. Purpose & Use of Information */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          2. Purpose &amp; Use of Information
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Your data is collected and processed for explicit and legitimate commercial purposes:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            To manufacture, laser-engrave, and encode your verified Google Review URL onto physical Smart NFC Standees.
          </li>
          <li>
            To pack, dispatch, and track your parcel shipments via authorized courier logistics partners.
          </li>
          <li>
            To provide active access to the merchant workspace, Google Review emotion reactions, and sentiment sorting software.
          </li>
          <li>
            To generate formal purchase receipts, GST invoices, and process subscription renewals or approved refunds.
          </li>
          <li>
            To provide customer support, resolve technical issues, and respond to inquiries submitted via our contact forms.
          </li>
        </ul>
      </section>

      {/* 3. Third-Party Data Disclosures */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          3. Third-Party Data Disclosures
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          We do not sell, rent, or trade your personal or business data to third-party advertisers or data brokers under any circumstances. We share information strictly with trusted operational service providers:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-gray-900">Payment Processing:</strong> PCI-DSS compliant payment processing, anti-fraud evaluation, and instant refund execution.
          </li>
          <li>
            <strong className="text-gray-900">Courier Carriers:</strong> Blue Dart, Delhivery, DTDC, India Post (strictly your shipping address and recipient phone number).
          </li>
          <li>
            <strong className="text-gray-900">Cloud Infrastructure:</strong> Google Cloud Platform &amp; Firebase for encrypted database hosting, daily backups, and uptime.
          </li>
        </ul>
      </section>

      {/* 4. Data Security, Retention & Encryption */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          4. Data Security, Retention &amp; Encryption
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          We implement comprehensive organizational and technical security measures including Transport Layer Security (TLS 1.3 / HTTPS) encryption across all web traffic and API endpoints, encrypted database storage at rest using Google Cloud security protocols, and strict role-based access control (RBAC).
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          We retain merchant order details for as long as your merchant subscription is active and for statutory periods required under Indian tax and accounting laws (typically 7 years for financial records).
        </p>
      </section>

      {/* 5. Your Rights under DPDPA 2023 */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          5. Your Rights under DPDPA 2023
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          As a data principal under the Digital Personal Data Protection Act 2023, you have the right to request an export or summary of your personal data, request correction or updating of inaccurate details, request erasure of your personal account data (subject to statutory financial retention mandates), or nominate an individual to exercise rights in the event of incapacity.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          To exercise any of these rights, email our Data Protection Desk at{' '}
          <a href="mailto:atelier@marts.com" className="text-[#1A73E8] hover:underline font-medium">
            atelier@marts.com
          </a>.
        </p>
      </section>

      {/* 6. Grievance Officer & Privacy Inquiries */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          6. Grievance Officer &amp; Privacy Inquiries
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          For grievances or complaints regarding data handling, please contact our designated Grievance Officer:
        </p>
        <div className="text-xs sm:text-sm text-gray-700 leading-relaxed space-y-1 pt-1">
          <p className="font-semibold text-gray-900">
            Sahanur Molla (Grievance Redressal &amp; Privacy Officer)
          </p>
          <p>MArts Handcrafted Studio</p>
          <p>North 24 Parganas, North 24 Parganas, West Bengal – 743425, India</p>
          <p>
            Email:{' '}
            <a href="mailto:atelier@marts.com" className="text-[#1A73E8] hover:underline font-medium">
              atelier@marts.com
            </a>
          </p>
          <p>
            Phone:{' '}
            <a href="tel:+919876543210" className="text-[#1A73E8] hover:underline font-medium">
              +91 9876543210
            </a>
          </p>
        </div>
      </section>
    </article>
  );
};

/* =========================================================================
   2. REFUNDS & REPLACEMENT POLICY (Completed Legal Document)
   ========================================================================= */
const RefundPolicyContent: React.FC = () => {
  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Refunds and replacement policy
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
          Our merchant-first guarantee, transparent return timelines, and automated refund processing protocols for physical NFC hardware and custom engraving.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Operated by MArts Handcrafted Studio under the MArts Guild Ecosystem • Artisanal Pottery & Sculpture Guild
        </p>
      </div>

      {/* MArts Guild Umbrella Scope */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          MArts Guild Ecosystem &amp; Umbrella Scope
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          This store (<span className="font-semibold text-gray-900">MArts</span>) operates under the unified <span className="font-semibold text-gray-900">MArts Guild</span> ecosystem (managed by MArts / Sahanur Molla). Every website, portal, sub-domain, online hardware checkout, and digital service under the MArts Guild umbrella falls strictly under this unified Privacy Policy, Data Protection, and Terms of Service framework. All refund requests, return requests, and hardware replacements across all MArts Guild endpoints are processed pursuant to these provisions.
        </p>
      </section>

      {/* 15-Day Guarantee Callout Box */}
      <section className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5">
        <h2 className="font-bold text-gray-900 text-sm sm:text-base">
          15-Day Hardware Replacement Guarantee &amp; 24-Hour Refund Verification
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 mt-2 leading-relaxed">
          We stand behind the engineering of every MArts Smart Standee and Tap Card. If your hardware arrives damaged, defective, or fails to scan, we provide a free 15-day express replacement. For eligible order cancellations, refunds are verified within 24 hours and credited back securely to your original payment method.
        </p>
        <p className="text-xs text-gray-500 mt-2.5">
          Applicable Laws: Consumer Protection (E-Commerce) Rules 2020 • Indian Contract Act 1872 • Payment Processing Merchant Guidelines.
        </p>
      </section>

      {/* 1. Order Cancellation Windows */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          1. Order Cancellation Windows
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          We understand that operational circumstances may change. Cancellation requests are handled according to the manufacturing stage of your order:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-gray-900">Before Custom Fabrication:</strong> You can cancel your order directly from the <Link to="/orders" className="text-[#1A73E8] hover:underline font-medium">My Orders</Link> dashboard or by contacting support before the laser engraving, UV printing, and NFC chip encoding phase begins.
          </li>
          <li>
            <strong className="text-gray-900">After Custom Fabrication Begins:</strong> Because MArts review stands are permanently customized with your specific Google Business Place ID, laser-cut acrylic, and custom business logo, customized items cannot be cancelled once laser cutting or UV curing has initiated.
          </li>
          <li>
            <strong className="text-gray-900">Verification Speed:</strong> Cancellation requests submitted through the portal are audited by our accounts team within 24 hours of submission.
          </li>
        </ul>
      </section>

      {/* 2. 15-Day Replacement Guarantee */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          2. 15-Day Replacement Guarantee (Damaged / Defective Hardware)
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          If your shipment arrives with any defect or damage, we provide an immediate, complimentary replacement unit within 15 days of parcel delivery under the following conditions:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-gray-900">Physical Transit Damage:</strong> Acrylic crack, wood fissure, or damaged silicone base upon unpacking.
          </li>
          <li>
            <strong className="text-gray-900">Defective NFC Chip:</strong> Failure to trigger contactless URL popup on NFC-enabled iOS (iPhone 7+) or Android devices.
          </li>
          <li>
            <strong className="text-gray-900">Faulty Dynamic QR:</strong> Scratched, unreadable, or misaligned QR code printing that fails to scan with native phone cameras.
          </li>
          <li>
            <strong className="text-gray-900">Encoding Discrepancy:</strong> The NFC chip redirects to an incorrect Google Business profile not matching your verified onboarding submission.
          </li>
        </ul>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed pt-1">
          To initiate an expedited replacement, email a brief 5-second video demonstrating the scan failure or photo of damage along with your Order ID to{' '}
          <a href="mailto:atelier@marts.com" className="text-[#1A73E8] hover:underline font-medium">
            atelier@marts.com
          </a>{' '}
          or message our WhatsApp desk at{' '}
          <a href="tel:+919876543210" className="text-[#1A73E8] hover:underline font-medium">
            +91 9876543210
          </a>.
        </p>
      </section>

      {/* 3. Non-Returnable Scenarios */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          3. Non-Returnable Scenarios
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Returns and replacements cannot be accepted under the following conditions:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>Normal cosmetic wear, surface scratches, or staining incurred after verified storefront deployment.</li>
          <li>Physical abuse, submersion in water, intentional disassembly, or exposure to open flames.</li>
          <li>Changes in your business name, relocation, or Google Business profile URL after artwork approval and successful delivery.</li>
        </ul>
      </section>

      {/* 4. Refund Processing & Banking Timelines */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          4. Refund Processing &amp; Banking Timelines
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Once your cancellation or refund request is approved, the refund transaction is transmitted to Payment Processing immediately. The funds are credited to your original payment method according to standard banking timelines:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-gray-900">UPI Payments (Google Pay, PhonePe, Paytm, BHIM):</strong> 24 to 48 banking hours.
          </li>
          <li>
            <strong className="text-gray-900">Net Banking:</strong> 2 to 4 business days depending on your bank.
          </li>
          <li>
            <strong className="text-gray-900">Credit / Debit Cards:</strong> 5 to 7 business days, reflecting in your card statement.
          </li>
          <li>
            <strong className="text-gray-900">Zero Restocking Fees:</strong> We do not charge hidden administrative restocking or cancellation penalties for approved returns.
          </li>
        </ul>
      </section>

      {/* Nominal ₹2 Verification Refund & General Issues Notice */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          Nominal ₹2 Verification Refund &amp; Mandatory WhatsApp Support Clause
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          During payment method verification or 14-day free trial authorization, a nominal authentication charge of <span className="font-semibold text-gray-900">₹2</span> is processed securely and scheduled for an automatic refund.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          If a customer/merchant does not receive the ₹2 refund within <span className="font-semibold text-gray-900">5 to 7 business days</span>, or encounters any transaction issue, billing dispute, or whatever problem with their account or service, they are required to contact support directly via WhatsApp at{' '}
          <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="text-[#1A73E8] hover:underline font-semibold">
            +91 9876543210
          </a>{' '}
          with their transaction reference.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          <strong className="text-gray-900">Merchant/Customer Responsibility &amp; Disclaimer of Liability:</strong> Failure or delay to notify support via WhatsApp within <span className="font-semibold text-gray-900">30 days</span> shall be conclusively deemed a voluntary waiver and sole negligence of the customer/merchant. MArts (MArts, MArts Guild, and its operators) holds zero financial liability, responsibility, or further obligation for unnotified claims or unclaimed amounts.
        </p>
      </section>

      {/* 5. Return Logistics & Reverse Pickup */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          5. Return Logistics &amp; Reverse Pickup
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          For verified replacement claims, MArts coordinates a reverse courier pickup from your business storefront at no cost to you via Delhivery or Blue Dart. If reverse pickup is unserviceable at your pincode, we reimburse the standard India Post Speed Post shipping fee upon receipt of the dispatch receipt.
        </p>
      </section>

      {/* 6. Contact Redressal Desk */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          6. Redressal &amp; Refund Inquiries
        </h2>
        <div className="text-xs sm:text-sm text-gray-700 leading-relaxed space-y-1">
          <p className="font-semibold text-gray-900">Sahanur Molla (Merchant Support &amp; Logistics)</p>
          <p>MArts Handcrafted Studio</p>
          <p>North 24 Parganas, North 24 Parganas, West Bengal – 743425, India</p>
          <p>
            Email:{' '}
            <a href="mailto:atelier@marts.com" className="text-[#1A73E8] hover:underline font-medium">
              atelier@marts.com
            </a>
          </p>
          <p>
            Phone:{' '}
            <a href="tel:+919876543210" className="text-[#1A73E8] hover:underline font-medium">
              +91 9876543210
            </a>
          </p>
        </div>
      </section>
    </article>
  );
};

/* =========================================================================
   3. TERMS AND CONDITIONS (Completed Legal Document)
   ========================================================================= */
const TermsConditionsContent: React.FC = () => {
  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Terms and conditions
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
          The legal contract governing the purchase of handcrafted pottery, ceramic vessels, monolithic stone statues, and the use of the MArts store.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Operated by MArts Handcrafted Studio under the MArts Guild Ecosystem • Artisanal Pottery & Sculpture Guild
        </p>
      </div>

      {/* Binding Agreement Box */}
      <section className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5">
        <h2 className="font-bold text-gray-900 text-sm sm:text-base">
          Binding Merchant Agreement &amp; Commercial Terms
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 mt-2 leading-relaxed">
          By accessing the MArts website, placing an order for handcrafted terracotta pottery, statues, or art decor, you enter into a legally binding agreement with <span className="font-semibold text-gray-900">MArts Handcrafted Studio</span>. If you do not agree with any part of these terms, please refrain from transacting on this platform.
        </p>
        <p className="text-xs text-gray-500 mt-2.5">
          Governing Law: Information Technology Act 2000 • Indian Contract Act 1872 • Jurisdiction: Kolkata, West Bengal.
        </p>
      </section>

      {/* 1. MArts Guild Ecosystem & Umbrella Scope */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          1. MArts Guild Ecosystem &amp; Umbrella Scope
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          This store (<span className="font-semibold text-gray-900">MArts</span>) operates under the unified <span className="font-semibold text-gray-900">MArts Guild</span> ecosystem (managed by MArts / Sahanur Molla). Every website, portal, sub-domain, online hardware checkout, and digital service under the MArts Guild umbrella falls strictly under this unified Privacy Policy, Data Protection, and Terms of Service framework.
        </p>
      </section>

      {/* 2. Commercial Scope & Merchant Hardware */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          2. Commercial Scope &amp; Hardware Specifications
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          MArts designs, manufactures, laser-engraves, and distributes hand-thrown terracotta pottery, vitrified ceramic vases, hand-carved stone statues, and brass sculptures.
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-gray-900">Passive NFC Operation:</strong> Every MArts standee integrates an authentic NTAG216 high-frequency (13.56 MHz) RFID/NFC chip programmed with your verified Google Business review redirection URL. The hardware is completely passive, requiring no batteries, internal charging, or recurring maintenance.
          </li>
          <li>
            <strong className="text-gray-900">Zero Mandatory Subscriptions:</strong> Standard hardware tap-and-review redirection operates perpetually without monthly hardware usage fees.
          </li>
        </ul>
      </section>

      {/* 3. Custom Fabrication & Content License */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          3. Custom Fabrication &amp; Content License
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          When submitting business names, storefront logos, artwork vectors, or Google Business Place IDs during checkout:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            You represent and warrant that you own or hold the requisite licenses and commercial authorization to reproduce the submitted logo and trademarks.
          </li>
          <li>
            You grant MArts a limited, non-exclusive license to format, laser-engrave, UV-cure, and encode the provided assets solely for producing your ordered physical hardware.
          </li>
          <li>
            We reserve the right to decline manufacture of materials containing defamatory, hate-speech, fraudulent, or copyright-infringing content.
          </li>
        </ul>
      </section>

      {/* 4. Pricing, Taxes & Payment Processing Payment Processing */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          4. Pricing, Taxes &amp; Payment Processing Payment Processing
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          All prices on the platform are stated in Indian Rupees (INR) and are inclusive of applicable Goods and Services Tax (GST) unless explicitly noted.
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            Payments are processed securely via the authorized <span className="font-semibold text-gray-900">Secure Payment Processing</span>. By confirming your order, you authorize Payment Processing to debit your chosen payment instrument.
          </li>
          <li>
            MArts does not record or store banking credentials, card numbers, or PINs.
          </li>
        </ul>
      </section>

      {/* 5. Nominal ₹2 Verification, Trial Authorization & Mandatory WhatsApp Support */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          5. Nominal ₹2 Verification Refund &amp; Mandatory WhatsApp Support Clause
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          During payment method verification or 14-day free trial authorization, a nominal authentication charge of <span className="font-semibold text-gray-900">₹2</span> is processed securely and scheduled for an automatic refund.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          If a customer/merchant does not receive the ₹2 refund within <span className="font-semibold text-gray-900">5 to 7 business days</span>, or encounters any transaction issue, billing dispute, or whatever problem with their account or service, they are required to contact support directly via WhatsApp at{' '}
          <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="text-[#1A73E8] hover:underline font-semibold">
            +91 9876543210
          </a>{' '}
          with their transaction reference.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          <strong className="text-gray-900">Merchant/Customer Responsibility &amp; Disclaimer of Liability:</strong> Failure or delay to notify support via WhatsApp within <span className="font-semibold text-gray-900">30 days</span> shall be conclusively deemed a voluntary waiver and sole negligence of the customer/merchant. MArts (MArts, MArts Guild, and its operators) holds zero financial liability, responsibility, or further obligation for unnotified claims or unclaimed amounts.
        </p>
      </section>

      {/* 6. Google LLC Disclaimer & Intellectual Property */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          6. Google LLC Disclaimer &amp; Intellectual Property
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Google, Google Maps, Google Reviews, and the Google "G" emblem are registered trademarks of Google LLC. MArts Handcrafted Studio is an independent hardware manufacturer and software provider and is not affiliated with, endorsed by, or an official agent of Google LLC.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          The proprietary hardware designs, structural acrylic contours, website user interface, and branding of MArts are the intellectual property of MArts Handcrafted Studio.
        </p>
      </section>

      {/* 7. Permitted Use & Hardware Restrictions */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          7. Permitted Use &amp; Hardware Restrictions
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Merchants agree to deploy MArts Handcrafted Creations strictly for legitimate customer review solicitation and feedback gathering at retail, dining, professional, or service counters. Merchants agree not to re-encode the NFC chips with malicious URLs, phishing portals, or malware distribution endpoints.
        </p>
      </section>

      {/* 8. Limitation of Liability */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          8. Limitation of Liability &amp; Warranty
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Except as provided under our <Link to="/refund-policy" className="text-[#1A73E8] hover:underline font-medium">15-Day Replacement Guarantee</Link>, all hardware and software services are provided on an &quot;as is&quot; and &quot;as available&quot; basis. MArts shall not be liable for indirect, punitive, or consequential damages resulting from algorithmic rating adjustments, review filters, or policy modifications enacted independently by Google LLC.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Our aggregate maximum liability under any claim arising out of your purchase shall not exceed the actual amount paid by you for the specific order. Furthermore, MArts (MArts, MArts Guild, and its operators) holds zero financial liability, responsibility, or further obligation for unnotified claims, billing discrepancies, or unclaimed amounts where the customer/merchant failed to contact support via WhatsApp within the mandatory 30-day reporting window.
        </p>
      </section>

      {/* 9. Governing Law & Legal Jurisdiction */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          9. Governing Law &amp; Legal Jurisdiction
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          These Terms of Service are governed by and construed in accordance with the laws of the Republic of India. In the event of any claim, dispute, or litigation arising from this agreement, the courts located in <span className="font-semibold text-gray-900">Kolkata, West Bengal, India</span> shall have exclusive jurisdiction.
        </p>
      </section>

      {/* 10. Merchant Legal Contact */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          10. Merchant Inquiries &amp; Legal Notices
        </h2>
        <div className="text-xs sm:text-sm text-gray-700 leading-relaxed space-y-1">
          <p className="font-semibold text-gray-900">Sahanur Molla (Proprietor &amp; Grievance Officer)</p>
          <p>MArts Handcrafted Studio</p>
          <p>North 24 Parganas, North 24 Parganas, West Bengal – 743425, India</p>
          <p>
            WhatsApp Support:{' '}
            <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="text-[#1A73E8] hover:underline font-medium">
              +91 9876543210
            </a>
          </p>
          <p>
            Email:{' '}
            <a href="mailto:atelier@marts.com" className="text-[#1A73E8] hover:underline font-medium">
              atelier@marts.com
            </a>
          </p>
          <p>
            Phone:{' '}
            <a href="tel:+919876543210" className="text-[#1A73E8] hover:underline font-medium">
              +91 9876543210
            </a>
          </p>
        </div>
      </section>
    </article>
  );
};

/* =========================================================================
   4. SHIPPING & DELIVERY POLICY (Completed Legal Document)
   ========================================================================= */
const ShippingPolicyContent: React.FC = () => {
  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Shipping and delivery policy
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
          Turnaround schedules, pan-India courier logistics, dispatch tracking, and parcel delivery commitments for custom smart hardware.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Operated by MArts Handcrafted Studio under the MArts Guild Ecosystem • Artisanal Pottery & Sculpture Guild
        </p>
      </div>

      {/* Fast Pan-India Express Logistics Box */}
      <section className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5">
        <h2 className="font-bold text-gray-900 text-sm sm:text-base">
          Fast Pan-India Express Logistics &amp; Insured Parcel Transit
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 mt-2 leading-relaxed">
          We partner with premier logistics networks including <span className="font-semibold text-gray-900">Blue Dart, Delhivery, DTDC, and India Post</span> to deliver MArts Handcrafted Creations securely to storefronts across all 28 states and 8 Union Territories of India. Every parcel is shock-padded and bubble-wrapped for safe transit.
        </p>
        <p className="text-xs text-gray-500 mt-2.5">
          Logistics Protocol: E-Way Bill Compliant • Real-time SMS &amp; WhatsApp Tracking • Insured Parcel Delivery.
        </p>
      </section>

      {/* 1. Production & Dispatch Turnaround */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          1. Production &amp; Dispatch Turnaround
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Because MArts products combine physical hardware fabrication with digital chip programming, order processing adheres to strict quality assurance steps:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-gray-900">Custom Engraved Standees:</strong> Laser cutting, UV printing of your storefront logo, and NTAG216 chip programming take approximately 24 to 48 hours following order confirmation.
          </li>
          <li>
            <strong className="text-gray-900">Standard Hardware &amp; Accessories:</strong> Non-customized tap pucks and standard stands are packaged and handed over to courier carriers within 24 hours of payment verification.
          </li>
        </ul>
      </section>

      {/* 2. Transit Times & Regional Delivery Estimates */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          2. Transit Times &amp; Regional Delivery Estimates
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Once your parcel is dispatched from our fulfillment facility in West Bengal, estimated delivery times are as follows:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-gray-900">Metro Cities (Delhi NCR, Mumbai, Bengaluru, Kolkata, Chennai, Hyderabad):</strong> 2 to 4 business days.
          </li>
          <li>
            <strong className="text-gray-900">Tier-2 &amp; Tier-3 Cities (Ahmedabad, Pune, Jaipur, Lucknow, Patna, Kochi, etc.):</strong> 3 to 6 business days.
          </li>
          <li>
            <strong className="text-gray-900">Northeast States, J&amp;K, and Remote Pincodes:</strong> 5 to 8 business days via India Post Speed Post or Delhivery Air.
          </li>
        </ul>
      </section>

      {/* 3. Tracking & Delivery Notifications */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          3. Tracking &amp; Delivery Notifications
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          As soon as your shipment is picked up by the logistics carrier, an automated tracking notification containing your Air Waybill (AWB) number and direct tracking link is sent to your registered phone number via WhatsApp / SMS and email.
        </p>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          You can also track real-time delivery milestones anytime from your <Link to="/orders" className="text-[#1A73E8] hover:underline font-medium">My Orders</Link> dashboard.
        </p>
      </section>

      {/* 4. Shipping Charges & Free Delivery */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          4. Shipping Charges &amp; Free Delivery
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Shipping rates are transparently displayed during checkout before final payment confirmation. Promotional campaigns may qualify for complimentary Free Pan-India Delivery as advertised on product detail pages.
        </p>
      </section>

      {/* 5. Undelivered Parcels & Address Corrections */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          5. Undelivered Parcels &amp; Address Corrections
        </h2>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          Courier personnel make up to 3 delivery attempts to your designated address. Please ensure your provided contact number is reachable for OTP verification. If you notice any typo in your address after checkout, please notify our logistics desk immediately at{' '}
          <a href="mailto:atelier@marts.com" className="text-[#1A73E8] hover:underline font-medium">
            atelier@marts.com
          </a>{' '}
          prior to package dispatch.
        </p>
      </section>

      {/* 6. Logistics & Shipping Helpdesk */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          6. Logistics &amp; Shipping Helpdesk
        </h2>
        <div className="text-xs sm:text-sm text-gray-700 leading-relaxed space-y-1">
          <p className="font-semibold text-gray-900">Sahanur Molla (Logistics &amp; Dispatch)</p>
          <p>MArts Handcrafted Studio</p>
          <p>North 24 Parganas, North 24 Parganas, West Bengal – 743425, India</p>
          <p>
            WhatsApp Support:{' '}
            <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="text-[#1A73E8] hover:underline font-medium">
              +91 9876543210
            </a>
          </p>
          <p>
            Email:{' '}
            <a href="mailto:atelier@marts.com" className="text-[#1A73E8] hover:underline font-medium">
              atelier@marts.com
            </a>
          </p>
          <p>
            Phone:{' '}
            <a href="tel:+919876543210" className="text-[#1A73E8] hover:underline font-medium">
              +91 9876543210
            </a>
          </p>
        </div>
      </section>
    </article>
  );
};

export default PolicyPage;
