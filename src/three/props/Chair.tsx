import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { Model } from '../Model'

export function Chair() {
  return (
    <Interactive id="chair" passive>
      <group position={LAYOUT.chair.position} rotation={LAYOUT.chair.rotation}>
        {/* Turned to face the desk; the model ships facing +Z. */}
        <Model name="chair" rotation={[0, Math.PI, 0]} />
      </group>
    </Interactive>
  )
}
