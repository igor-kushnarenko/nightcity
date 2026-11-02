import json,urllib.request,urllib.parse,os
K="https://disk.yandex.ru/d/2XFcu0SB-vUlSA";A="https://cloud-api.yandex.net/v1/disk/public/resources"
def get(u): return json.load(urllib.request.urlopen(u))
def walk(p):
  d=get(A+"?"+urllib.parse.urlencode({"public_key":K,"path":p,"limit":100}))
  for i in d["_embedded"]["items"]:
    if i["type"]=="dir": walk(i["path"])
    else:
      h=get(A+"/download?"+urllib.parse.urlencode({"public_key":K,"path":i["path"]}))["href"]
      out="."+i["path"]; os.makedirs(os.path.dirname(out),exist_ok=True)
      urllib.request.urlretrieve(h,out); print(os.path.getsize(out),i["size"],out)
walk("/")
