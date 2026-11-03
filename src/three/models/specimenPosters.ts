import quartzPoster from '../../assets/specimens/quartz.webp'
import pyritePoster from '../../assets/specimens/pyrite.webp'
import feldsparPoster from '../../assets/specimens/feldspar.webp'
import micaPoster from '../../assets/specimens/mica.webp'
import calcitePoster from '../../assets/specimens/calcite.webp'
import talcPoster from '../../assets/specimens/talc.webp'
import graphitePoster from '../../assets/specimens/graphite.webp'
import granitePoster from '../../assets/specimens/granite.webp'
import limestonePoster from '../../assets/specimens/limestone.webp'
import gneissPoster from '../../assets/specimens/gneiss.webp'
import type { SpecimenId } from './creatures'

export const SPECIMEN_POSTERS: Partial<Record<SpecimenId, string>> = {
  quartz: quartzPoster,
  pyrite: pyritePoster,
  feldspar: feldsparPoster,
  mica: micaPoster,
  calcite: calcitePoster,
  talc: talcPoster,
  graphite: graphitePoster,
  granite: granitePoster,
  limestone: limestonePoster,
  gneiss: gneissPoster,
}
