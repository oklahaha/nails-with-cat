/**
 * Placeholder for the 預約 tab. The tab press is intercepted in the layout and
 * opens the add modal; this only renders if /new is opened directly (web).
 */
import { Redirect } from 'expo-router';

export default function NewAppointmentTab() {
  return <Redirect href="/add-appointment" />;
}
