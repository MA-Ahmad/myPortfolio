export const GA_TRACKING_ID = process.env.GA_TRACKING_ID

// Theme Studio previews a page in a frame before opening it; that isn't a visit.
const tracking = () =>
  Boolean(GA_TRACKING_ID) && typeof window.gtag === 'function' && window.self === window.top

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url) => {
  if (!tracking()) return
  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  })
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({ action, category, label, value }) => {
  if (!tracking()) return
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  })
}
