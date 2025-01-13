export function executeFunction<F extends (...args: any[]) => any>(
  parent: any,
  funcName: string,
  params: Record<string, any>,
): ReturnType<F> {
  const func=parent[funcName]
  const boundFunc = func.bind(parent);

  // Obtenir les noms des paramètres de la fonction
  const paramNames = getFunctionParameterNames(func);

  // Reconstituer les arguments dans le bon ordre
  const args = paramNames.map(name => params[name]);

  // Appeler la fonction avec les arguments
  return boundFunc(...args);
}

// Fonction utilitaire pour obtenir les noms des paramètres d'une fonction
function getFunctionParameterNames(func: Function): string[] {
  const fnStr = func.toString();
  const paramMatch = fnStr.match(/\(([^)]*)\)/);
  if (!paramMatch || !paramMatch[1]) {
    return [];
  }

  return paramMatch[1]
    .split(",")
    .map(param => param.trim())
    .filter(param => param);
}
