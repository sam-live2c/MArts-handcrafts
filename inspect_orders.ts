import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, collection, terminate } from 'firebase/firestore';
import cfg from './firebase-applet-config.json';
import * as fs from 'fs';

const app = initializeApp(cfg);
const db = getFirestore(app);

async function run() {
  const result: any = {};
  
  // 1. Check orders collection
  const o1 = await getDoc(doc(db, 'orders', 'OD804861027660'));
  result['orders_OD804861027660'] = o1.data();
  
  const o2 = await getDoc(doc(db, 'orders', 'OD38528814788'));
  result['orders_OD38528814788'] = o2.data();

  // 2. Check candidate user documents
  const candUids = [
    'Dwm0CEXBCQf06llxDoxVswxMQDd2',
    'marts_user_prople_org_gmail_com',
    'prople.org@gmail.com',
    'sahanurmolla077@gmail.com',
    'marts_user_sahanurmolla077_gmail_com'
  ];

  for (const uid of candUids) {
    const uSnap = await getDoc(doc(db, 'users', uid));
    if (uSnap.exists()) {
      const uData = uSnap.data();
      result[`user_${uid}`] = {
        email: uData.email,
        name: uData.name,
        orders_length: (uData.orders || []).length,
        orders: uData.orders
      };
    } else {
      result[`user_${uid}`] = 'NOT_FOUND';
    }

    // Check subcollection
    const subSnap = await getDocs(collection(db, 'users', uid, 'orders'));
    result[`user_${uid}_suborders_count`] = subSnap.size;
    result[`user_${uid}_suborders`] = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  fs.writeFileSync('orders_dump.json', JSON.stringify(result, null, 2));
  console.log('DUMP COMPLETED TO orders_dump.json');
  await terminate(db);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
