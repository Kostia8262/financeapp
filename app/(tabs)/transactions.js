import { useRouter } from 'expo-router';
import TransactionsScreen from '../../src/screens/TransactionsScreen';

export default function TransactionsRoute() {
  const router = useRouter();
  const navigation = {
    navigate: (name, params) => {
      if (name === 'AddTransaction') {
        if (params?.transaction) {
          const t = params.transaction;
          router.push({
            pathname: '/add-transaction',
            params: { id: t.id, amount: t.amount, type: t.type, category_id: t.category_id, note: t.note, date: t.date },
          });
        } else {
          router.push('/add-transaction');
        }
      }
    },
  };
  return <TransactionsScreen navigation={navigation} />;
}
