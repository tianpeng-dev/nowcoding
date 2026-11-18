async function launch() {
  await magpie.ready;
  const options = await magpie.options.get();
  const url = new URL(magpie.service || `http://127.0.0.1:${options.port ?? 37481}/`);
  url.searchParams.set('theme', magpie.theme.dark ? 'dark' : 'light');
  location.replace(url.href);
}
launch().catch((error) => {
  document.querySelector('[role=status]').textContent = error.message;
});
