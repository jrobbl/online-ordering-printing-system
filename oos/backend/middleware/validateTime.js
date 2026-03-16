/**
 * Middleware to validate ordering hours.
 * Hours are configured via ORDER_HOUR_START and ORDER_HOUR_END env vars.
 */
function validateOrderingTime(req, res, next) {
    // Get current time
    const now = new Date();
    const currentHour = now.getHours();

    const startHour = parseInt(process.env.ORDER_HOUR_START) || 6;
    const endHour   = parseInt(process.env.ORDER_HOUR_END)   || 23;

    if (currentHour < startHour || currentHour >= endHour) {
        return res.status(400).json({
            error: 'No se aceptan pedidos a esta hora',
            message: `Los pedidos solo se pueden realizar entre ${startHour}:00 y ${endHour}:00`,
            current_time: now.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            ordering_hours: `${startHour}:00 - ${endHour}:00`
        });
    }

    // Time is valid, proceed to next middleware/route handler
    next();
}

// Export middleware function
module.exports = validateOrderingTime;
