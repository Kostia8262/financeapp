import { useRouter } from 'expo-router';
import HomeScreen from '../../src/screens/HomeScreen';

export default function HomeRoute() {
  const router = useRouter();
  const navigation = {
    navigate: (name, params) => {
      if (name === 'AddTransaction') router.push({ pathname: '/add-transaction', params: params || {} });
      else if (name === 'Transactions') router.push('/(tabs)/transactions');
      else if (name === 'Reports')      router.push('/(tabs)/reports');
      else if (name === 'Categories')   router.push('/(tabs)/categories');
      else if (name === 'Settings')     router.push('/(tabs)/settings');
      else if (name === 'Profile')      router.push('/profile');
    },
  };
  return <HomeScreen navigation={navigation} />;
}
