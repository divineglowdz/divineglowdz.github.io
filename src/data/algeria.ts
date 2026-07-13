import type { DeliveryRate } from '../types'

const names = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Bejaia','Biskra','Bechar','Blida','Bouira',
  'Tamanrasset','Tebessa','Tlemcen','Tiaret','Tizi Ouzou','Alger','Djelfa','Jijel','Setif','Saida',
  'Skikda','Sidi Bel Abbes','Annaba','Guelma','Constantine','Medea','Mostaganem','MSila','Mascara','Ouargla',
  'Oran','El Bayadh','Illizi','Bordj Bou Arreridj','Boumerdes','El Tarf','Tindouf','Tissemsilt','El Oued','Khenchela',
  'Souk Ahras','Tipaza','Mila','Ain Defla','Naama','Ain Temouchent','Ghardaia','Relizane','Timimoun','Bordj Badji Mokhtar',
  'Ouled Djellal','Beni Abbes','In Salah','In Guezzam','Touggourt','Djanet','El Mghair','El Meniaa',
]

export const defaultDeliveryRates: DeliveryRate[] = names.map((wilaya_name, index) => {
  const number = index + 1
  const zone = number === 16 ? 0 : number <= 48 ? 1 : 2
  return {
    wilaya_code: String(number).padStart(2, '0'), wilaya_name,
    home_price: zone === 0 ? 500 : zone === 1 ? 900 : 1100,
    office_price: zone === 0 ? 400 : zone === 1 ? 600 : 800,
    active: true,
  }
})
