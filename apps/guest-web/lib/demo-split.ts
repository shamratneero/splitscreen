export const demoSplit = {
  restaurant: "Sultan's Dine",
  date: "4 Sep · Dinner with friends",
  hostName: "Neero",
  payment: { bkash: "017XXXXXXXX", nagad: "018XXXXXXXX" },
  vat: 110,
  serviceCharge: 70,
  items: [
    { id: "biryani", name: "Chicken Biryani", price: 280, available: 2 },
    { id: "rezala", name: "Beef Rezala", price: 320, available: 1 },
    { id: "coke", name: "Coke", price: 60, available: 3 },
    { id: "naan", name: "Garlic naan", price: 90, available: 2 },
  ],
} as const;
