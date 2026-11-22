import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS } from '../theme';

/**
 * Driver dispatch sheet, laid out the way Black River's dispatchers send it:
 *
 *   #9925 Dispatch / Truck / Trailer / Team Drivers
 *   1. Pick Up info: Name, Address, Phone, Pick Up Number, Appointment Date, Temperature, Note
 *   2. Drop Off info: Name, Address, Phone, Drop Off Number, Appointment Date, Temperature, Note
 *   (every extra pickup / drop-off stop gets its own numbered block, in order)
 */

type AnyObj = Record<string, any>;

interface Props {
  trip: AnyObj;
  order: AnyObj;
}

interface StopBlock {
  kind: 'Pick Up' | 'Drop Off';
  name: string;
  address: string;
  phone: string;
  number: string;
  appointment: string;
  temperature: string;
  note: string;
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

// "+1" or "+1 " on its own is a placeholder, not a phone number
const cleanPhone = (v: unknown) => {
  const p = str(v);
  return p.replace(/\D/g, '').length > 2 ? p : '';
};

const pad = (n: number) => String(n).padStart(2, '0');
const formatAppt = (date?: unknown, time?: unknown) => {
  const d = str(date);
  if (!d) return str(time);
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return [d, str(time)].filter(Boolean).join(' ');
  const datePart = `${pad(parsed.getMonth() + 1)}/${pad(parsed.getDate())}/${parsed.getFullYear()}`;
  const t = str(time) || (/T\d{2}:\d{2}/.test(d) ? `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : '');
  return [datePart, t].filter(Boolean).join(' ');
};

const formatTemp = (value: unknown, unit: unknown) => {
  const t = str(value);
  if (!t) return '';
  const u = str(unit).toLowerCase();
  const suffix = u.startsWith('f') ? '°F' : u.startsWith('c') ? '°C' : '';
  return `${t}${suffix}`;
};

const unitLabel = (u?: AnyObj) =>
  u ? str(u.unitNo || u.unitNumber || u.internalId || u.trailerNumber || u.plateNumber || u.licensePlate) : '';

const placeAddress = (loc?: AnyObj) =>
  str(loc?.place || loc?.placeId?.currentLocation?.address || loc?.placeId?.name);

const buildStops = (order: AnyObj): StopBlock[] => {
  const temp = formatTemp(order.temperature, order.temperatureUnit);
  const pickApptDetails = order.pickupAppointmentDetails || {};
  const dropApptDetails = order.deliveryAppointmentDetails || {};

  const mainPickup: StopBlock = {
    kind: 'Pick Up',
    name: str(order.shipper?.name),
    address: str(order.shipper?.address) || placeAddress(order.pickupLocation),
    phone: cleanPhone(order.shipper?.phone || order.shipper?.primaryPhone),
    number: str(order.pickupRefNo),
    appointment: formatAppt(pickApptDetails.date || order.pickupDate, pickApptDetails.time || order.pickupTime),
    temperature: temp,
    note: str(order.pickupNote),
  };
  const mainDrop: StopBlock = {
    kind: 'Drop Off',
    name: str(order.receiver?.name),
    address: str(order.receiver?.address) || placeAddress(order.deliveryLocation),
    phone: cleanPhone(order.receiver?.phone),
    number: str(order.dropOffNumber || order.deliveryRefNo),
    appointment: formatAppt(dropApptDetails.date || order.deliveryDate, dropApptDetails.time || order.deliveryTime),
    temperature: temp,
    note: str(order.dropOffNotes || order.deliveryNote),
  };

  // The order form copies the main pickup/drop-off into the stops table, so skip exact repeats
  const same = (a: StopBlock, b: StopBlock) =>
    a.address.toLowerCase() === b.address.toLowerCase() && a.number === b.number;

  const pickups: StopBlock[] = [mainPickup];
  (order.stops || []).forEach((s: AnyObj) => {
    const block: StopBlock = {
      kind: 'Pick Up',
      name: str(s.shipper),
      address: str(s.address),
      phone: cleanPhone(s.contact),
      number: str(s.pickUpNumber),
      appointment: formatAppt(s.date),
      temperature: formatTemp(s.temperature, order.temperatureUnit) || temp,
      note: str(s.notes),
    };
    if (!pickups.some((p) => same(p, block))) pickups.push(block);
  });

  const drops: StopBlock[] = [mainDrop];
  (order.receiverStops || []).forEach((s: AnyObj) => {
    const block: StopBlock = {
      kind: 'Drop Off',
      name: str(s.receiver),
      address: str(s.address),
      phone: cleanPhone(s.contact),
      number: str(s.dropOffNumber),
      appointment: formatAppt(s.date),
      temperature: formatTemp(s.temperature, order.temperatureUnit) || temp,
      note: str(s.notes),
    };
    if (!drops.some((d) => same(d, block))) drops.push(block);
  });

  return [...pickups, ...drops];
};

const Line = ({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) => (
  <View style={styles.line}>
    <Text style={styles.label}>{label}: </Text>
    {onPress && value ? (
      <TouchableOpacity onPress={onPress} style={styles.valueWrap}>
        <Text style={[styles.value, styles.link]}>{value}</Text>
      </TouchableOpacity>
    ) : (
      <Text style={[styles.value, !value && styles.empty]}>{value || '—'}</Text>
    )}
  </View>
);

const DispatchSheet = ({ trip, order }: Props) => {
  const number = str(order.customerOrderNo || order.orderNumber || trip.tripNumber);
  const drivers = [trip.driver?.name, trip.coDriver?.name].map(str).filter(Boolean);
  const stops = buildStops(order);

  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>#{number} Dispatch</Text>
      <Line label="Truck" value={unitLabel(trip.truck) ? `#${unitLabel(trip.truck)}` : ''} />
      <Line label="Trailer" value={unitLabel(trip.trailer) ? `#${unitLabel(trip.trailer)}` : ''} />
      <Line label={drivers.length > 1 ? 'Team Drivers' : 'Driver'} value={drivers.join(' & ')} />

      {stops.map((s, i) => (
        <View key={`${s.kind}-${i}`} style={styles.stop}>
          <Text style={[styles.stopTitle, s.kind === 'Drop Off' && styles.dropTitle]}>
            {i + 1}. {s.kind} info:
          </Text>
          <Line label="Name" value={s.name} />
          <Line
            label="Address"
            value={s.address}
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`)}
          />
          <Line label="Phone" value={s.phone} onPress={() => Linking.openURL(`tel:${s.phone.replace(/[^\d+]/g, '')}`)} />
          <Line label={`${s.kind} Number`} value={s.number} />
          <Line label="Appointment Date" value={s.appointment} />
          <Line label="Temperature" value={s.temperature} />
          <Line label="Note" value={s.note} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  stop: { marginTop: 12 },
  stopTitle: { fontSize: 15, fontWeight: '700', color: COLORS.accentBlue, marginBottom: 4 },
  dropTitle: { color: COLORS.accentGreen },
  line: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  valueWrap: { flexShrink: 1 },
  value: { fontSize: 14, color: COLORS.textSecondary, flexShrink: 1 },
  link: { color: COLORS.accentBlue, textDecorationLine: 'underline' },
  empty: { opacity: 0.5 },
});

export default DispatchSheet;
