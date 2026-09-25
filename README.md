# Portfolit

Un portfolio cripto simple, con estética matrix. Muestra las cryptos que
tenés, sus precios en vivo y el valor de cada posición, y te deja simular
"qué pasaría si" sobre cualquier precio sin tocar los datos reales.

- **Next.js 15** (App Router) + React 19
- **Tailwind CSS** para los estilos
- **Jest** para los tests
- **CoinGecko** como fuente de precios, sin API key

## Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:3000
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | Build de producción |
| `npm start` | Sirve el build de producción |
| `npm test` | Corre los tests |
| `npm run lint` | ESLint |

> **No corras `npm run dev` y `npm run build` al mismo tiempo.** Los dos
> escriben en `.next` y se pisan entre sí: el build falla con
> `Cannot find module for page: /favicon.ico` o el dev server queda sirviendo
> 404. Si vas a buildear, pará el dev server primero.

## Qué hace

- **Login** con usuario o como invitado.
- **Portfolio** con las cryptos que tengas y su cantidad. Al principio tenés
  BTC, ETH, BNB, SOL y XRP en cero; con `+` y `-` agregás o sacás posiciones.
  El símbolo se autocompleta con la búsqueda de CoinGecko.
- **Precios en vivo** refrescados cada 60 segundos. Se cachea el mapeo
  símbolo → id de CoinGecko en `localStorage` para no consultarlo cada vez.
- **Ticker** arriba con los precios.
- **Ojo** en el título para ocultar los balances.

## Simulación de precios

Lo central de la app. Es un *overlay* efímero: simula sobre lo que ves, sin
modificar nunca el precio real.

### Cómo se usa

- **Tocás una fila** (cualquier celda) y queda seleccionada: tinte verde y un
  cursor `▌` parpadeante.
- **Desde ahí, la rueda o el swipe ajustan esa fila** estés donde estés
  dentro de la tabla. El cursor no hace falta que esté encima: es la selección
  la que define el objetivo, no la posición del puntero.
- **Se pueden simular varias filas a la vez.** Tocar otra fila solo cambia cuál
  está seleccionada, nunca descarta lo que ya simulé.
- **`volver a real`** es el único que limpia: descarta todas las simulaciones.
- En desktop el paso es adaptativo al precio (más o menos 0.5-0.9% por muesca)
  y `Shift` lo multiplica por 5.
- En touch el paso es de 320px de dedo, porque el dedo recorre mucho menos
  recorrido útil que un notch de rueda.
- El swipe responde en la celda del precio y en la del total parcial, que es
  donde cae el dedo. En el resto de la fila el dedo scrollea la página normal.

### Qué se ve

- El precio simulado reemplaza al real, y el **delta flota** junto a él y
  junto al total: arriba en verde si suma, abajo en rojo si resta. El flotante
  es `position: absolute`, así que no cambia el ancho ni el alto de la fila.
- El **% de simulación** reemplaza la variación de 24h en la fila
  seleccionada. En el encabezado, `~~24h~~` pasa a decir `simulación`.
- Mobile y desktop muestran lo mismo. En mobile se achican los pisos de ancho
  de las columnas y se desactiva la selección de texto, que competía con el
  swipe. El precio real tachado solo se muestra a partir de `sm`.

### Por qué es efímero

- La simulación vive en un estado de React aparte y **nunca muta `precios`**.
- Se guarda el **offset porcentual**, no el precio absoluto, así que sobrevive
  al refresco de 60s y se recalcula contra el precio nuevo.
- **No se persiste** en `localStorage` ni en la base: recargar la descarta.

## Tests

`npm test` corre dos suites: la resolución de precios contra CoinGecko y la
lógica de simulación. Esta última no depende de React ni de un DOM, porque toda
la lógica vive en `app/utils/simulation.js` como funciones puras.

## Estructura

```
app/
  components/
    CryptoPortfolio.js    tabla, simulación, alta/baja de posiciones
    CryptoModal.js        formulario de alta/baja
    CryptoMarquee.js      ticker de precios
    LoginPage.js          login
  utils/
    simulation.js         lógica pura de simulación (sin React)
    coinGecko.js          resolución y fetch de precios
  globals.css             cursor, flotantes, scroll, selección de texto
  page.js                 login, precios, layout
__tests__/                tests de simulación y de coinGecko
```

## Notas de implementación

- **Una sola línea por celda**, en todos los estados y en los dos tamaños. Es
  una restricción de diseño, no un accidente: si agregás contenido a una
  celda, revisá que la fila no se parta.
- **El flotante vive en el padding de su propia fila.** En desktop las celdas
  usan `sm:py-3` justamente para darle aire: con `py-2` la fila mide 36px y
  entre el borde y los dígitos no entra el flotante de 10px. El offset
  acompaña ese padding.
- **La rueda necesita un listener nativo** con `{ passive: false }` sobre la
  tabla. React la registra como pasiva, así que un `preventDefault` en el
  handler de React no alcanzaría a frenar el scroll de la página.
- **La tabla scrollea en horizontal** por `.table-scroll`, con la barrita
  oculta. Es lo que evita que las columnas se compriman y el texto se parta.
