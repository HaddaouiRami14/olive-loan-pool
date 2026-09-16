// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error("[error]", err);
  const rawStatus = err.statusCode ?? (typeof err.status === "number" ? err.status : 500);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  res.status(status).json({
    error: true,
    message: err.message ?? "Erreur interne",
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: true, message: `Route introuvable: ${req.method} ${req.path}` });
}
