const form = document.querySelector('.answer-form');
if (form) {
  const required = Number(form.dataset.count), button = document.querySelector('#answer-submit');
  const update = () => {
    const count = form.querySelectorAll('input[name="answer"]:checked').length;
    button.disabled = count !== required;
    document.querySelector('#selected-count').textContent = `${count} / ${required} válasz kijelölve · A kiértékelés a kör végén jelenik meg.`;
  };
  form.addEventListener('change', update);
  form.addEventListener('submit', () => { button.disabled = true; button.textContent = 'Mentés…'; });
  update();
}
document.querySelector('#mistakes-only')?.addEventListener('change', (event) => {
  document.querySelectorAll('.review-item.is-correct').forEach(item => { item.hidden = event.target.checked; });
});
