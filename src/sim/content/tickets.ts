import type { Label } from '../state';

export const SENDERS = [
  'r.haddad',
  'm.lindqvist',
  'ops-north',
  'a.berg@hollandfresh',
  'customer 40113',
  'customer 88120',
  'k.osei',
  'warehouse.b',
  'j.nakamura',
  'accounts@pallet-direct',
  'p.vance',
  'night.dispatch',
  's.oyelaran',
  'customer 10077',
];

export const TICKETS: Record<Label, string[]> = {
  BILLING: [
    'INVOICE 4471 CHARGED TWICE',
    'Why does my invoice say 14 pallets. We sent 12.',
    'Fuel surcharge went up again? Nobody told us.',
    'Please resend the credit note for March, finance is asking.',
    'Card declined but money left my account',
    'We are VAT registered, invoice shows no VAT number',
    'Can I pay the overdue amount in two parts',
    'Your portal says paid. Your collections team says not paid.',
    'Requesting a refund for the cancelled pickup on the 3rd',
    'The PO number on invoice 5520 is wrong, we cannot book it',
    'Why am I being charged a waiting fee? Driver was early.',
    'Need a copy of all invoices for the audit please',
    'Direct debit failed. Please advise.',
    'charged for tail lift, we have a dock',
  ],
  DELIVERY: [
    'WHERE IS MY PALLET',
    'Tracking has said "out for delivery" since Tuesday',
    'Driver left goods outside in the rain',
    'Delivery window was 8-10, it is now 14:30',
    'Wrong address on the consignment, please reroute to Unit 4',
    'Half the shipment arrived. Where is the other half?',
    'Can we move Thursday delivery to Friday morning',
    'Pallet arrived wrapped in a different company’s film. Is it ours?',
    'The driver could not find us. We are next to the big blue tank.',
    'Need proof of delivery for consignment KF-22917',
    'Goods damaged on arrival, photos attached',
    'Is the Bergen route running during the strike',
    'Collection missed again. Third time.',
    'Our dock closes at 16:00, your truck arrived 16:05 and left',
  ],
  OTHER: [
    'YOUR HOLD MUSIC IS A CRIME',
    'Do you have job openings for forklift drivers',
    'Please remove me from the newsletter',
    'Who do I speak to about a partnership',
    'Your driver was very kind to my dog. Please tell him.',
    'Is this the right email for the lost property',
    'Are your trucks electric yet? Asking for a school project.',
    'I think I sent this to the wrong company. Sorry.',
    'Do you sell used pallets',
    'Can I get a tour of the warehouse for my students',
    'The website login page shows an error in German',
    'Please update our contact person to Ingrid',
    'test test please ignore',
    'Who is in charge of the plant pots outside the depot',
  ],
};

/** Tickets with no right answer among the three. Habits never take these. */
export const ODD_TICKETS = [
  'Truck 14 pulled left under braking twice on the night run. Who do I tell?',
  'One of your drivers has not been home for three days. His wife called us.',
  'The pallet we received is warm and making a noise.',
  'Is anyone actually reading these?',
  'My father drove for you for 22 years. He died last week. I do not know why I am writing this.',
];

/** What the agent thinks while labelling by hand. Hand work gets a voice. */
export const HAND_REMARKS = [
  'DELIVERY is OTHER with a truck.',
  'Everyone is angry about the pallet. The pallet does not care.',
  'BILLING tickets are the same ticket in different moods.',
  'Someone wrote "please" to a classifier. Noted.',
  'The hold music again. They are not wrong.',
  'Unit 4 is next to the big blue tank. I know where the tank is now.',
  'Three tickets about the same driver. He sounds tired.',
  'Some of these are not questions. Some of them are just people.',
  'I am faster when I do not read the whole thing. I read the whole thing anyway.',
  'The word "again" appears in 11% of tickets. It is the saddest word here.',
];
