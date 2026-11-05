# Introduction to Akkoma-FE
## What is Akkoma-FE?

Akkoma-FE is the default user-facing frontend for Pleroma. It's user interface is modeled after Qvitter which is modeled after an older Twitter design. It provides a simple 2-column interface for microblogging. While being simple by default it also provides many powerful customization options.

## How can I use it?

If your instance uses Akkoma-FE, you can acces it by going to your instance (e.g. <https://pleroma.soykaf.com>). You can read more about it's basic functionality in the [Akkoma-FE User Guide](./user_guide/). We also have [a guide for administrators](./CONFIGURATION.md) and for [hackers/contributors](./HACKING.md).

## Switching frontends

If your instance offers more than one frontend, you can choose which one your browser uses
at `<instance>/akkoma/frontend` (e.g. <https://akkoma.example/akkoma/frontend>).
Pick a frontend and reload the page.
The choice is stored in a cookie, so it only applies to your current browser; it does not affect other users or the admin interface.

If only one frontend is listed, your instance does not offer a choice.
Instance administrators can configure the available frontends as described
in the backend's [Frontend Management](https://docs.akkoma.dev/stable/configuration/frontend_management/) documentation.
