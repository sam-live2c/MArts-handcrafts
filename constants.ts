import { Product, Category } from './types';

export const CATEGORIES: Category[] = [
  {
    id: 'all',
    name: 'All Pieces',
    icon: 'Sparkles',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDlWOXWx_A646SBbiBzFa73Hab7QqE2U-X_kdBVFSf1npxZSVPUBtV_dTQDeA65F8LLHSWKcASFfhRhJ01F7KgF-xUXyWWV3UnCkw_udpj0w6XRm5rJ3STPkaX1FFLByjSaB4Bmn-YI3rOeiFV5wbnySDYwXTkAuTupN9hk5hJlRrjeiNppiReCSTPW5XUlCv8IOpdHtbDG2xxmcoefKO7LcwAAPonm1EPuzjMAx8TmmShwbFfO6dBWgA'
  },
  {
    id: 'tableware',
    name: 'Tableware',
    icon: 'ShoppingBag',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkdZmB2TSZqyF6v2ctk1ASc5_Z7pfeZcTfk-X5qWJDt60Anmf-n_ai7KiIaEn-2ZN3dm5-FTl9Oof2-qAGZoT9TMciBxPReGGDrJ1O8LTll6BIteLYiPUyS9kP-p0IAR9qR8_UVE-GS_caFUnpH_MeYOUZv4IeoNl8sKmMUta050G7x-YZI8c9HrKaAfw-1AwEziIBzmzZEhfEgvHJAUSFzf-Yc8IrSxxBFIpBTxAvPs9rOJL9sU_tYw'
  },
  {
    id: 'vessels',
    name: 'Vessels & Vases',
    icon: 'Layers',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2FfYO24t4gfejQgEjnxQWoLxHQr9M2VFxaKDE8uKEZ3Dhu3MYwh8lTC4xh4Alip2GtvqDddS-LcP4to2PdK-9-rzjBx3aIpO9SlIKtOd2PpliyqaJHvBd2M-4it5HN_s1k3wMEsNaoinHg1cmChBeQL4b9SloRaIxuotiPsHuKAGEb2PGxwdD31RcgagcqGRUnNPYmaMRKi2i8d2nqMbej_Uk-OnVGn7sIXywj5AjdHlwjiVQ5_b6kw'
  },
  {
    id: 'decor',
    name: 'Ritual & Decor',
    icon: 'Award',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCEo26C7ZyQzikYByJggUMkqSWSoY0Q7kX--qInEWnzfnabfJD1wLO6w_FEcYwaGBZpaxZacVN0Ow82gNn8jbfyrIH8vSJyUSblqrNyYXit-s3hnOUwfq1oljtUmPQc_367Erap48Pn88UPmmsaTqAF8EiKnESYxpd91yJLezP0xw_GMQi9mDigTU5GidQsfWl24cwEW3Bvqm5KwHbrW1Z62LvoeUDi2cGYg3HesBpRHBGm_4tdZ00jIQ'
  }
];

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Solstice Raw Rim Pitcher',
    category: 'tableware',
    subCategory: 'Sand & Terracotta Matte Glaze',
    price: 88,
    oldPrice: 110,
    discount: '20% off',
    rating: 5.0,
    reviewsCount: 34,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDlWOXWx_A646SBbiBzFa73Hab7QqE2U-X_kdBVFSf1npxZSVPUBtV_dTQDeA65F8LLHSWKcASFfhRhJ01F7KgF-xUXyWWV3UnCkw_udpj0w6XRm5rJ3STPkaX1FFLByjSaB4Bmn-YI3rOeiFV5wbnySDYwXTkAuTupN9hk5hJlRrjeiNppiReCSTPW5XUlCv8IOpdHtbDG2xxmcoefKO7LcwAAPonm1EPuzjMAx8TmmShwbFfO6dBWgA',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDlWOXWx_A646SBbiBzFa73Hab7QqE2U-X_kdBVFSf1npxZSVPUBtV_dTQDeA65F8LLHSWKcASFfhRhJ01F7KgF-xUXyWWV3UnCkw_udpj0w6XRm5rJ3STPkaX1FFLByjSaB4Bmn-YI3rOeiFV5wbnySDYwXTkAuTupN9hk5hJlRrjeiNppiReCSTPW5XUlCv8IOpdHtbDG2xxmcoefKO7LcwAAPonm1EPuzjMAx8TmmShwbFfO6dBWgA',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBf_e1GZ98KK19bSRStlKcmIMOVS_9xGx-KbnEq6x7E2TlAgcaBePqWrsMIoG-uPPEfw3TwAlLTLlVMrj4vIp2jZnAqHn4NTSsJTYllUvoEu9k3-3eylkXC44v9h_r8sE9vbEnJwC-VwCav0BKl7z9d4ENHOm31295UuK4w_DWNPkFtL0SvWg_QNae9KOoS6bRjOJmhAf7nlgopIn66I_WCJqbzBDxOX6wyKNUyUJ9E_oS2SjK-TSHbmQ',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCkdZmB2TSZqyF6v2ctk1ASc5_Z7pfeZcTfk-X5qWJDt60Anmf-n_ai7KiIaEn-2ZN3dm5-FTl9Oof2-qAGZoT9TMciBxPReGGDrJ1O8LTll6BIteLYiPUyS9kP-p0IAR9qR8_UVE-GS_caFUnpH_MeYOUZv4IeoNl8sKmMUta050G7x-YZI8c9HrKaAfw-1AwEziIBzmzZEhfEgvHJAUSFzf-Yc8IrSxxBFIpBTxAvPs9rOJL9sU_tYw'
    ],
    description: 'Handcrafted ceramic pouring pitcher with ergonomic handle and exposed raw stoneware rim, glazed in speckled sand matte tone. Centered manually on the potter wheel and vitrified at 1,250°C Cone 10 for enduring kitchen durability.',
    brand: 'MArts Studio',
    highlights: [
      '100% Non-Toxic Natural Mineral Glaze',
      'Exposed Tactile Raw Stoneware Rim',
      'High-Fired at 1,250°C Cone 10',
      'Lead-Free, Food Safe, Dishwasher & Microwave Friendly',
      'Hand-Thrown in Small Batches'
    ],
    specGroups: [
      {
        title: 'Studio Details',
        specs: {
          'Origin': 'MArts Family Atelier',
          'Firing': 'Cone 10 (1250°C) Reduction',
          'Capacity': '1,100 ml (37 fl oz)',
          'Weight': '840g',
          'Material': 'Regional Iron-Rich Stoneware Clay'
        }
      }
    ],
    isAssured: true,
    stock: 18,
    sellerName: 'MArts Studio Atelier',
    sellerRating: 5.0,
    returnPolicy: '30-Day Studio Guarantee'
  },
  {
    id: '2',
    name: 'Komorebi Fluted Vase',
    category: 'vessels',
    subCategory: 'Organic Speckled Cream Stoneware',
    price: 120,
    oldPrice: 145,
    discount: '17% off',
    rating: 5.0,
    reviewsCount: 18,
    image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1000&q=80',
    images: [
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'An organic fluted ceramic vase crafted from speckled cream stoneware showing vertical throwing grooves in delicate daylight. Limited studio run of only 25 pieces.',
    brand: 'MArts Studio',
    highlights: [
      'Limited Atelier Batch of 25 Numbered Pieces',
      'Subtle Tactile Vertical Throwing Ridges',
      'Watertight Interior for Live Florals or Dried Grasses',
      'Warm Neutral Palette That Complements Any Space'
    ],
    specGroups: [
      {
        title: 'Specifications',
        specs: {
          'Height': '24 cm (9.5 inches)',
          'Diameter': '14 cm (5.5 inches)',
          'Weight': '1.2 kg',
          'Glaze': 'Matte Feldspar Speckle'
        }
      }
    ],
    isAssured: true,
    stock: 7,
    sellerName: 'MArts Studio Atelier',
    sellerRating: 5.0,
    returnPolicy: '30-Day Studio Guarantee'
  },
  {
    id: '3',
    name: 'Wabi Ribbed Espresso Tumbler (Set of 2)',
    category: 'tableware',
    subCategory: 'Charcoal Ash Wood-Fired Glaze',
    price: 54,
    oldPrice: 65,
    discount: '17% off',
    rating: 5.0,
    reviewsCount: 42,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCwqg_iPvpzqoiUvwUnVZSV4jhRVSRZfpY8n7qXGZREp2OYmuRs3mLLIsC6IvNOmGGa2wOS0y1tAOtGY-qAMzxZ6-WAUXcdEO225Slar8LtNCnMy2k_h4_wIIAjr1058KWyqM1gQ6lT5U-UM3HK9_XaX19UY5ocSPhOQqHo6SJ83dpf4waEcJ3QVA6FbJML0LoYId8PTvSMMW29BCZNCOZVp6W4hAJTfTAwOhoNgtCtX_nk8oIc_AZ9Sw',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCwqg_iPvpzqoiUvwUnVZSV4jhRVSRZfpY8n7qXGZREp2OYmuRs3mLLIsC6IvNOmGGa2wOS0y1tAOtGY-qAMzxZ6-WAUXcdEO225Slar8LtNCnMy2k_h4_wIIAjr1058KWyqM1gQ6lT5U-UM3HK9_XaX19UY5ocSPhOQqHo6SJ83dpf4waEcJ3QVA6FbJML0LoYId8PTvSMMW29BCZNCOZVp6W4hAJTfTAwOhoNgtCtX_nk8oIc_AZ9Sw',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCTHEZpM4OIbBIoCk3IdiQeD5ejEQNybIQN6JygfR1OP-BhH9ihNsea0KSff2L2pPsrjnhG-1ASlT3O717vHiBf6gxVT08-HtfaPxph3PxVpZib3r1qWjmPwLtUbzZ54xr7UUSG9DunH7zr54_ACOWRdXIl-Y0EamyhKlPq0KTKYXGlfrgfj1H1mZYNVPkM6Jmj8Ih_WbAD8xpG9JzPdSlqZAkNo0Y5uRpDaMW6D0LwtsdhtbIyVEEHiA'
    ],
    description: 'Pair of tactile espresso ceramic tumblers with natural ribbed texture dipped in dark charcoal ash glaze standing side by side. Perfect thermal retention for double shots or ceremonial matcha.',
    brand: 'MArts Studio',
    highlights: [
      'Set of Two Hand-Pinched Espresso Cups',
      'Real Wood-Ash Reduction Dip',
      'Pleasing Tactile Ridges for Non-Slip Grip',
      'Retains Heat Without Burning Fingertips'
    ],
    specGroups: [
      {
        title: 'Specifications',
        specs: {
          'Capacity': '120 ml each (4 fl oz)',
          'Diameter': '6.8 cm',
          'Height': '7.2 cm',
          'Quantity': 'Pair (2 pieces)'
        }
      }
    ],
    isAssured: true,
    stock: 22,
    sellerName: 'MArts Studio Atelier',
    sellerRating: 5.0,
    returnPolicy: '30-Day Studio Guarantee'
  },
  {
    id: '4',
    name: 'Terra Shallow Pasta Bowl',
    category: 'decor',
    subCategory: 'Iron-rich Clay & Satin White',
    price: 62,
    oldPrice: 75,
    discount: '17% off',
    rating: 5.0,
    reviewsCount: 29,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6fjtwcXSnE6ay89UctyM21w4kVZfmG0dqhdlXqu08KKvDIuQS1RBnQghuQ2UbzHzCLHXd3-mgHO40fE4Az0myKZ8yRKOSe9AUp_PmEX4pfF3mvIWhEjE1MIBA-ZGo-PzM0JO9zNA26gXOr_4TpgwpzdpXESCu_rrqF4wqZxrMM1izjNyBlSZnnmnlDIIyyPa4QVthmlUhhirJLFEHA8LrD33YjuNSRpVPk2q1B2buu9TtjBqDHYfGWg',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD6fjtwcXSnE6ay89UctyM21w4kVZfmG0dqhdlXqu08KKvDIuQS1RBnQghuQ2UbzHzCLHXd3-mgHO40fE4Az0myKZ8yRKOSe9AUp_PmEX4pfF3mvIWhEjE1MIBA-ZGo-PzM0JO9zNA26gXOr_4TpgwpzdpXESCu_rrqF4wqZxrMM1izjNyBlSZnnmnlDIIyyPa4QVthmlUhhirJLFEHA8LrD33YjuNSRpVPk2q1B2buu9TtjBqDHYfGWg',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCfWl-R75G3vwd7cC6G5vunxvKJx1uyPfpV_P-Ftxp7MBjrML31lrY8yuwhn7M4CUdNYDAN1XtMF3qri5zxoibUWW8lJz14ijCknJoF19dxrEftjXKIBxI8dMtpsNeKWwaUImMCF2SY6_A_ASTWGjj-jUe55ymzOp7nsiEWMoveEm2xHjO_vOOYiGwdL346HnA1hkJvgmo6s8jjCMGtx882URf-9zc-IBjR0mYdsGrZmZVcbZpu43BGdw'
    ],
    description: 'Wide shallow ceramic pasta bowl made from warm iron-rich terracotta clay with soft satin eggshell white interior glaze. Broad rim framed for serving pasta, grain salads, and slow stews.',
    brand: 'MArts Studio',
    highlights: [
      'Broad Shallow Lip for Plating Comfort',
      'Dual Surface: Unglazed Outer Terra, Glazed Interior',
      'Scratch-Resistant Satin White Glaze',
      'Dishwasher Safe for Daily Family Meals'
    ],
    specGroups: [
      {
        title: 'Specifications',
        specs: {
          'Diameter': '22 cm (8.7 inches)',
          'Depth': '4.5 cm (1.8 inches)',
          'Weight': '620g',
          'Clay': 'High-Iron Stoneware'
        }
      }
    ],
    isAssured: true,
    stock: 14,
    sellerName: 'MArts Studio Atelier',
    sellerRating: 5.0,
    returnPolicy: '30-Day Studio Guarantee'
  }
];
