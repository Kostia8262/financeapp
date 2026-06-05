import { useRouter, useLocalSearchParams } from 'expo-router';
import AddTransactionScreen from '../src/screens/AddTransactionScreen';

export default function AddTransactionRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const navigation = { goBack: () => router.back() };

  let transaction = null;
  if (params.id) {
    transaction = {
      id: Number(params.id),
      amount: Number(params.amount),
      type: params.type,
      category_id: params.category_id ? Number(params.category_id) : null,
      note: params.note || '',
      date: params.date,
    };
  }

  const route = {
    params: transaction
      ? { transaction }
      : {
          initialType:       params.initialType       || undefined,
          initialCategoryId: params.initialCategoryId ? Number(params.initialCategoryId) : undefined,
        },
  };

  return <AddTransactionScreen navigation={navigation} route={route} />;
}
