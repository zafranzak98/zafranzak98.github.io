// Adds "Visual editor" to the website editor (/admin): a button in its top bar on computers and a
// link on its Menu page on phones, opening the visual editor (/admin/design) in a new tab.
// Loaded after Sveltia, from the site itself (the page's security policy allows nothing else).
;(function add(tries) {
  if (window.CMS && typeof window.CMS.registerCustomPage === 'function') {
    window.CMS.registerCustomPage({ id: 'design', label: 'Visual editor', url: '/admin/design/', newTab: true })
  } else if (tries < 100) setTimeout(() => add(tries + 1), 100)
})(0)
