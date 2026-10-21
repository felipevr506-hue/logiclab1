import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/entrar",
  "/cadastro",
  "/onboarding",
  "/dashboard",
  "/trilha",
  "/linguagens",
  "/habilidades",
  "/recompensas",
  "/praticar",
  "/laboratorio",
  "/playground",
  "/missoes",
  "/projetos",
  "/portfolio",
  "/evolucao",
  "/relatorio",
  "/prova",
  "/revisar",
  "/caderno",
  "/atividade",
  "/glossario",
  "/buscar",
  "/perfil",
  "/assinatura",
  "/admin",
  "/termos",
  "/privacidade",
  "/treino/primeiros-passos",
  "/treino/tipos-de-dados",
  "/treino/operadores",
  "/treino/comparacoes",
  "/treino/repeticoes-iniciais",
  "/treino/arrays-iniciais",
  "/treino/funcoes-iniciais",
  "/treino/variaveis",
  "/treino/condicoes",
  "/treino/loops",
  "/treino/listas",
  "/treino/calculadora",
  "/treino/funcoes",
  "/treino/textos",
];

const widths = [360, 390, 430, 768, 1024, 1366, 1440, 1920];
const browserZoomLevels = [90, 100, 110, 125, 150];

test.describe("legibilidade responsiva", () => {
  for (const width of widths) {
    test(`${width}px mantém leitura, viewport e layout`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "A matriz completa roda uma vez com viewport controlado.",
      );
      await page.setViewportSize({
        width,
        height: width <= 430 ? 844 : width <= 1100 ? 900 : 1000,
      });

      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("body")).toBeVisible();

        const viewport = await page
          .locator('meta[name="viewport"]')
          .getAttribute("content");
        expect(viewport, route).toContain("width=device-width");
        expect(viewport, route).toContain("initial-scale=1");
        expect(viewport, route).toContain("maximum-scale=5");
        expect(viewport, route).not.toContain("user-scalable=no");

        const layout = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(
          layout.scrollWidth,
          `${route} transbordou em ${width}px`,
        ).toBeLessThanOrEqual(layout.clientWidth + 2);

        const undersized = await page.evaluate((mobile) => {
          const selectors =
            "p, li, button, input, textarea, select, a, small, label, b, span, code";
          return [...document.querySelectorAll<HTMLElement>(selectors)]
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                !element.closest('[aria-hidden="true"]') &&
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0 &&
                rect.right > 0 &&
                rect.left < window.innerWidth &&
                (element.textContent?.trim() ||
                  element instanceof HTMLInputElement ||
                  element instanceof HTMLTextAreaElement ||
                  element instanceof HTMLSelectElement)
              );
            })
            .map((element) => ({
              element,
              size: Number.parseFloat(getComputedStyle(element).fontSize),
            }))
            .filter(({ element, size }) => {
              const terminalOrCode =
                element.matches("code") ||
                Boolean(element.closest(".console-panel"));
              const secondary = element.matches(
                "small, .example-box > span, .hint-button span, .eyebrow, .section-label, .card-eyebrow",
              );
              const minimum =
                terminalOrCode || secondary ? 14 : mobile ? 16 : 14;
              return size + 0.05 < minimum;
            })
            .slice(0, 8)
            .map(({ element, size }) => ({
              tag: element.tagName.toLowerCase(),
              className: element.className,
              text: element.textContent?.trim().slice(0, 55),
              size,
            }));
        }, width <= 430);
        expect(
          undersized,
          `${route} tem texto pequeno em ${width}px: ${JSON.stringify(undersized)}`,
        ).toEqual([]);
      }
    });
  }

  test("zoom de 90% a 150% mantém todas as rotas utilizáveis", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "A equivalência de zoom roda uma vez com viewport controlado.",
    );
    test.setTimeout(180_000);

    for (const zoom of browserZoomLevels) {
      // O zoom do navegador altera a largura CSS disponível. Em uma janela
      // física de 1440px, esta é a largura equivalente para cada nível.
      const equivalentCssWidth = Math.round(1440 / (zoom / 100));
      await page.setViewportSize({ width: equivalentCssWidth, height: 1000 });

      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("body")).toBeVisible();
        const layout = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(
          layout.scrollWidth,
          `${route} transbordou no equivalente a ${zoom}%`,
        ).toBeLessThanOrEqual(layout.clientWidth + 2);
      }
    }
  });
});
