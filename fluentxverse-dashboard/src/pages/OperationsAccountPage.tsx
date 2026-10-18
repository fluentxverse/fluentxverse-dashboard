import { useLocation, useRoute } from 'preact-iso';
import { OperationsAccountDetail } from '../components/OperationsAccountDetail';
import TutorsPage from './TutorsPage';

export default function OperationsAccountPage() {
  const { role = '', id = '' } = useRoute().params;
  const { route } = useLocation();
  const initialTab = new URLSearchParams(window.location.search).get('tab') === 'compensation' ? 'compensation' : 'profile';
  return role === 'tutor'
    ? <TutorsPage key={id} initialAccount={{ id, tab: initialTab }} onAccountClose={() => route('/tutors', true)} />
    : <OperationsAccountDetail key={id} role={role} id={id} initialTab={initialTab} />;
}
