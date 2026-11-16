// Worker de pruebas desactivado tras finalizar. No acepta solicitudes ni almacena datos.
export default { async fetch() {
 return new Response(JSON.stringify({error:'Prueba de Entrenamiento desactivada'}),{status:410,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}};
