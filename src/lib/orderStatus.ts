import type { OrderStatus } from '../types'

export const orderStatuses: OrderStatus[] = ['nouvelle', 'confirmee', 'preparee', 'expediee', 'livree', 'annulee', 'retour']

export const orderStatusLabels: Record<OrderStatus, string> = {
  nouvelle: 'Nouvelle',
  confirmee: 'Confirmée',
  preparee: 'Préparée',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
  retour: 'Retour',
}

export const releasesOrderStock = (status: string) => status === 'annulee' || status === 'retour'
