from PIL import Image
import numpy as np, os, json
import sys
SRC=sys.argv[1] if len(sys.argv)>1 else 'reference/game-elements-sheet.png'
OUT='client/public/assets'
im=Image.open(SRC).convert('RGBA')
P=4
items={
 'cards/back':(31,29,263,195),
 'cards/number-red':(31,212,263,349),
 'cards/number-yellow':(31,358,263,492),
 'cards/number-green':(31,501,263,636),
 'cards/number-blue':(31,645,263,780),
 'cards/skip-red':(31,790,263,926),
 'cards/reverse-yellow':(31,935,263,1069),
 'cards/draw2-green':(31,1077,263,1214),
 'cards/wild':(31,1222,263,1359),
 'cards/wild4':(31,1368,263,1513),
 'avatars/witch':(291,36,431,178),
 'avatars/tinkerer':(294,338,431,480),
 'avatars/cleric':(294,655,431,797),
 'avatars/catfolk':(293,965,431,1107),
 'decorations/card-fan':(311,1280,418,1496),
 'backgrounds/city-skyline':(456,30,618,514),
 'decorations/witch-silhouette':(460,537,624,719),
 'decorations/banner':(456,908,617,1028),
 'decorations/lamp':(459,1055,624,1104),
 'decorations/airship':(499,742,587,901),
 'decorations/crystal-ball':(496,1121,617,1220),
 'decorations/books':(533,1242,617,1370),
 'decorations/candles':(494,1394,617,1501),
 'backgrounds/table':(638,41,824,594),
 'decorations/black-cat':(676,638,804,818),
 'decorations/sprout-a':(659,857,800,964),
 'decorations/sprout-b':(681,978,794,1070),
 'effects/sparkle-big':(671,1118,773,1208),
 'effects/sparkle-purple':(697,1227,745,1267),
 'effects/sparkle-small':(751,1199,799,1237),
 'effects/sparkle-purple-2':(741,1261,783,1295),
 'effects/shooting-star':(684,1338,786,1500),
 'icons/btn-refresh':(856,36,975,155),
 'icons/btn-players':(856,170,975,288),
 'icons/btn-settings':(856,303,975,421),
 'icons/btn-cards':(857,452,976,635),
 'icons/btn-ready':(857,661,976,847),
 'icons/btn-play':(844,877,994,1204),
 'icons/swatch-red':(882,1231,955,1299),
 'icons/swatch-yellow':(882,1302,955,1370),
 'icons/swatch-green':(882,1372,955,1440),
 'icons/swatch-blue':(882,1442,955,1510),
}
# avatar pills (status panel bars)
items['decorations/pill-red']=(310,178,410,307)
manifest={}
for k,(y0,x0,y1,x1) in items.items():
    box=(max(0,x0-P),max(0,y0-P),min(1536,x1+P),min(1024,y1+P))
    c=im.crop(box)
    os.makedirs(os.path.dirname(f'{OUT}/{k}.png'),exist_ok=True)
    c.save(f'{OUT}/{k}.png')
    manifest[k]=c.size
print(json.dumps(manifest))
