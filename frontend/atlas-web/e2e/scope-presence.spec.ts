import { test, expect } from '@playwright/test';
import { axe } from './helpers';
const B='https://scope.atlas.test', S='org:first/ws:core', T='org:second/ws:core';
for(const outcome of ['Effective','Unknown']) test(`scope switch ${outcome} preserves command identity and checks readback`,async({context,page})=>{
  let scope=S,posts=0,operation:any=null;
  await context.route(`${B}/**`,route=>{
    const request=route.request(),u=new URL(request.url());
    const headers={'access-control-allow-origin':request.headers().origin||'*','access-control-allow-credentials':'true','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST'};
    const json=(data:unknown,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(request.method()==='POST'){posts++;operation=request.postDataJSON();if(outcome==='Unknown')return json({},500);return json({...operation,stage:'Effective'});}
    if(u.pathname==='/effect'){const receipt={operationId:operation.operationId,resourceId:operation.resourceId,scope:S,fingerprint:operation.fingerprint,revision:2,evidenceId:'matched-scope-receipt'};scope=T;return json(receipt);}
    if(u.pathname==='/v1/capabilities')return json({protocol:'atlas-ui/v1',audience:'workspace',scope,serviceSessionHref:`${B}/session`,modules:{tenancy:{collectionHref:`${B}/tenancy`},execution:{collectionHref:`${B}/execution`}}});
    if(u.pathname==='/session')return json({subject:'scope-reader',scope,audience:'workspace',scopeContext:{org:scope,workspace:'Core',project:null},grants:['project:manage'],expiresAt:null,csrfToken:'test-only'});
    if(u.pathname==='/tenancy')return json({complete:true,observedAt:new Date().toISOString(),items:[{id:'scope-choice',name:'Second organization',scope,revision:1,status:'Available',observedAt:new Date().toISOString(),fields:{target_scope:T},actions:[{id:'switch',label:'Switch scope',grant:'project:manage',href:`${B}/switch`,effectHref:`${B}/effect`,resourceId:'scope-choice',expectedRevision:1}]}]});
    return json({complete:true,observedAt:new Date().toISOString(),items:[]});
  });
  await page.goto('/connection');await page.fill('#service-endpoint',B);await page.getByRole('button',{name:'Connect',exact:true}).click();await expect(page.getByText('scope-reader',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Switch organization',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Switch organization and project'});
  await expect(dialog.locator('option[value="scope-choice"]')).toHaveCount(1);await dialog.getByLabel('Authorized scope').selectOption('scope-choice');
  await axe(page,'authorized scope switch');
  await dialog.getByRole('button',{name:'Switch scope',exact:true}).dblclick();
  if(outcome==='Effective'){await expect(dialog).not.toBeVisible();await expect(page.locator('.tenant-context')).toContainText(T);await page.goto('/identity');const membership=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Membership, invitations & effective access',exact:true})});await expect(membership).toContainText(T);await expect(membership).toContainText('Core');}
  else {await expect(dialog.getByRole('alert')).toContainText('Unknown');await expect(dialog).toContainText(S);expect(scope).toBe(S);}
  expect(posts).toBe(1);expect(operation.scope).toBe(S);expect(operation.input.targetScope).toBe(T);expect(operation.expectedRevision).toBe(1);
});
